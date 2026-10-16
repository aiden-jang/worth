package com.aidenjang.worth;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

final class WidgetClient {
  static final ExecutorService WORK = Executors.newSingleThreadExecutor();

  static final class Reconnect extends Exception {}

  private static JSONObject request(String path, String method, String token, JSONObject body)
      throws Exception {
    HttpsURLConnection connection =
        (HttpsURLConnection) new URL(Proof.ORIGIN + "/api/widgets/" + path).openConnection();
    connection.setInstanceFollowRedirects(false);
    connection.setUseCaches(false);
    connection.setConnectTimeout(10000);
    connection.setReadTimeout(15000);
    connection.setRequestMethod(method);
    if (token != null) connection.setRequestProperty("Authorization", "Bearer " + token);
    try {
      if (body != null) {
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        try (java.io.OutputStream output = connection.getOutputStream()) {
          output.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
      }
      int status = connection.getResponseCode();
      if (status == 401 || status == 403) throw new Reconnect();
      if (status < 200 || status >= 300)
        throw new IllegalStateException("Couldn’t connect. Try again.");
      if (status == 204) return new JSONObject();
      try (InputStream input = connection.getInputStream();
          ByteArrayOutputStream result = new ByteArrayOutputStream()) {
        byte[] bytes = new byte[4096];
        int count;
        while ((count = input.read(bytes)) != -1) {
          if (result.size() + count > 262144)
            throw new IllegalStateException("Unreadable response");
          result.write(bytes, 0, count);
        }
        return new JSONObject(result.toString(StandardCharsets.UTF_8.name()));
      }
    } finally {
      connection.disconnect();
    }
  }

  static void exchange(Context context) throws Exception {
    JSONObject pending = Vault.read(context).optJSONObject("pending");
    if (pending == null || System.currentTimeMillis() - pending.getLong("startedAt") >= 900000)
      throw new Reconnect();
    JSONObject next =
        request(
            "token",
            "POST",
            null,
            new JSONObject()
                .put("code", pending.getString("code"))
                .put("verifier", pending.getString("verifier")));
    if (!next.getString("accessToken").matches("[A-Za-z0-9_-]{43}")
        || next.getLong("expiresAt") <= System.currentTimeMillis()) throw new Reconnect();
    java.util.UUID.fromString(next.getString("deviceId"));
    synchronized (Vault.LOCK) {
      JSONObject current = Vault.read(context);
      if (current.optJSONObject("pending") == null
          || !pending
              .getString("state")
              .equals(current.getJSONObject("pending").getString("state"))) throw new Reconnect();
      Vault.write(context, new JSONObject().put("credential", next));
    }
  }

  static void refresh(Context context) throws Exception {
    JSONObject state = Vault.read(context), credential = state.optJSONObject("credential");
    if (credential == null) throw new Reconnect();
    String device = credential.getString("deviceId"), filter = Vault.filter(state);
    try {
      if (credential.getLong("expiresAt") <= System.currentTimeMillis()) throw new Reconnect();
      JSONObject snapshot =
          request("snapshot?find=" + filter, "GET", credential.getString("accessToken"), null);
      if (snapshot.getInt("schemaVersion") != 1
          || snapshot.getJSONArray("collections").length() > 5
          || snapshot.getLong("expiresAt") > credential.getLong("expiresAt")
          || !Proof.usable(
              snapshot.getLong("updatedAt"),
              snapshot.getLong("expiresAt"),
              System.currentTimeMillis())) throw new IllegalStateException("Unreadable snapshot");
      synchronized (Vault.LOCK) {
        JSONObject current = Vault.read(context);
        if (current.optJSONObject("credential") == null
            || !device.equals(current.getJSONObject("credential").getString("deviceId"))
            || !filter.equals(Vault.filter(current))) return;
        Vault.write(
            context,
            current
                .put("snapshot", snapshot)
                .put("snapshotDevice", device)
                .put("snapshotFilter", filter));
      }
    } catch (Reconnect reconnect) {
      synchronized (Vault.LOCK) {
        JSONObject current = Vault.read(context);
        if (current.optJSONObject("credential") != null
            && device.equals(current.getJSONObject("credential").getString("deviceId")))
          Vault.clear(context);
      }
      throw reconnect;
    } finally {
      WorthWidget.updateAll(context);
    }
  }

  static void revoke(Context context) throws Exception {
    JSONObject credential = Vault.read(context).optJSONObject("credential");
    if (credential == null) return;
    try {
      request("connection", "DELETE", credential.getString("accessToken"), null);
    } catch (Reconnect alreadyRevoked) {
      /* Clear the unusable local copy. */
    }
    synchronized (Vault.LOCK) {
      JSONObject current = Vault.read(context).optJSONObject("credential");
      if (current != null && current.getString("deviceId").equals(credential.getString("deviceId")))
        Vault.clear(context);
    }
    WorthWidget.updateAll(context);
  }
}
