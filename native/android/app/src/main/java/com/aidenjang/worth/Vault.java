package com.aidenjang.worth;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

// Tokens, pending proofs and cached names share encrypted storage; Android backup is disabled.
final class Vault {
  static final Object LOCK = new Object();
  private static final String ALIAS = "worth-widget-local-v1";

  private static SecretKey key() throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias(ALIAS))
      return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
    KeyGenerator generator =
        KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(
        new KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
    return generator.generateKey();
  }

  static JSONObject read(Context context) throws Exception {
    synchronized (LOCK) {
      String saved =
          context
              .getSharedPreferences("widget-vault", Context.MODE_PRIVATE)
              .getString("sealed", null);
      if (saved == null) return new JSONObject();
      JSONObject envelope = new JSONObject(saved);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(
          Cipher.DECRYPT_MODE,
          key(),
          new GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)));
      JSONObject state =
          new JSONObject(
              new String(
                  cipher.doFinal(Base64.decode(envelope.getString("data"), Base64.NO_WRAP)),
                  StandardCharsets.UTF_8));
      long now = System.currentTimeMillis();
      boolean changed = false;
      JSONObject pending = state.optJSONObject("pending"),
          credential = state.optJSONObject("credential");
      if (pending != null
          && (pending.optLong("startedAt") > now || now - pending.optLong("startedAt") >= 900000)) {
        state.remove("pending");
        changed = true;
      }
      if (credential != null && credential.optLong("expiresAt") <= now) {
        state.remove("credential");
        state.remove("collection");
        clearSnapshot(state);
        changed = true;
      }
      if (state.has("snapshot") && snapshot(state) == null) {
        clearSnapshot(state);
        changed = true;
      }
      if (changed) write(context, state);
      return state;
    }
  }

  static void write(Context context, JSONObject state) throws Exception {
    synchronized (LOCK) {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key());
      JSONObject envelope =
          new JSONObject()
              .put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
              .put(
                  "data",
                  Base64.encodeToString(
                      cipher.doFinal(state.toString().getBytes(StandardCharsets.UTF_8)),
                      Base64.NO_WRAP));
      if (!context
          .getSharedPreferences("widget-vault", Context.MODE_PRIVATE)
          .edit()
          .putString("sealed", envelope.toString())
          .commit()) throw new IllegalStateException("Could not save device storage");
    }
  }

  static void clear(Context context) {
    synchronized (LOCK) {
      if (!context
          .getSharedPreferences("widget-vault", Context.MODE_PRIVATE)
          .edit()
          .clear()
          .commit()) throw new IllegalStateException("Could not clear device storage");
    }
  }

  static String filter(JSONObject state) {
    String filter = state.optString("filter", "all");
    return java.util.Arrays.asList("all", "want", "queue", "favorites").contains(filter)
        ? filter
        : "all";
  }

  static JSONObject snapshot(JSONObject state) {
    JSONObject credential = state.optJSONObject("credential"),
        snapshot = state.optJSONObject("snapshot");
    if (credential == null
        || snapshot == null
        || !credential.optString("deviceId").equals(state.optString("snapshotDevice"))
        || !filter(state).equals(state.optString("snapshotFilter"))
        || snapshot.optInt("schemaVersion") != 1
        || snapshot.optLong("expiresAt") > credential.optLong("expiresAt")
        || !Proof.usable(
            snapshot.optLong("updatedAt"),
            snapshot.optLong("expiresAt"),
            System.currentTimeMillis())) return null;
    return snapshot;
  }

  static void clearSnapshot(JSONObject state) {
    state.remove("snapshot");
    state.remove("snapshotDevice");
    state.remove("snapshotFilter");
  }
}
