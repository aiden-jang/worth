package com.aidenjang.worth;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.*;
import java.text.DateFormat;
import java.util.Date;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
  private LinearLayout content;
  private boolean busy;
  private String status = "";
  private final int paper = Color.rgb(240, 236, 223), muted = Color.rgb(170, 169, 155);

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    handle(getIntent());
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    handle(intent);
  }

  private void handle(Intent intent) {
    Uri uri = intent.getData();
    // Remove proof-bearing callback data from the Activity's retained intent immediately.
    setIntent(new Intent(this, MainActivity.class));
    if (uri != null
        && "com.aidenjang.worth".equals(uri.getScheme())
        && "/widget-callback".equals(uri.getPath())) {
      if (busy) return;
      try {
        synchronized (Vault.LOCK) {
          JSONObject state = Vault.read(this), pending = state.optJSONObject("pending");
          if (pending == null) throw new IllegalStateException();
          Proof proof =
              new Proof(
                  pending.getString("verifier"),
                  pending.getString("state"),
                  pending.getLong("startedAt"));
          String code = proof.code(uri.toString(), System.currentTimeMillis());
          if (code == null) throw new IllegalStateException();
          pending.put("code", code);
          Vault.write(this, state);
        }
        run(
            () -> {
              WidgetClient.exchange(this);
              WidgetClient.refresh(this);
            },
            "Connected and updated.");
        return;
      } catch (Exception invalid) {
        status = "Couldn’t confirm this return. Start a fresh connection.";
      }
    }
    render();
  }

  private interface Work {
    void perform() throws Exception;
  }

  private void run(Work work, String success) {
    if (busy) return;
    busy = true;
    render();
    WidgetClient.WORK.execute(
        () -> {
          String result;
          try {
            work.perform();
            result = success;
          } catch (WidgetClient.Reconnect expired) {
            result = "Connection expired, canceled or revoked. Start again.";
          } catch (Exception unavailable) {
            result =
                "Couldn’t complete this. Check your connection and retry. You can forget unreadable"
                    + " device storage below.";
          }
          final String message = result;
          runOnUiThread(
              () -> {
                busy = false;
                status = message;
                if (!isFinishing() && !isDestroyed()) render();
              });
        });
  }

  private TextView text(String value, int size, int color) {
    TextView view = new TextView(this);
    view.setText(value);
    view.setTextSize(size);
    view.setTextColor(color);
    view.setPadding(0, 12, 0, 12);
    content.addView(view);
    return view;
  }

  private void button(String title, Runnable action) {
    Button view = new Button(this);
    view.setText(title);
    view.setAllCaps(false);
    view.setMinHeight(dp(48));
    view.setEnabled(!busy);
    view.setOnClickListener(v -> action.run());
    content.addView(view);
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  private void open(String url) {
    try {
      startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
    } catch (android.content.ActivityNotFoundException unavailable) {
      status = "Install or enable a browser to continue.";
      render();
    }
  }

  private void connect() {
    try {
      Proof proof = new Proof(Proof.secret(), Proof.secret(), System.currentTimeMillis());
      synchronized (Vault.LOCK) {
        JSONObject state = Vault.read(this);
        state.put(
            "pending",
            new JSONObject()
                .put("verifier", proof.verifier)
                .put("state", proof.state)
                .put("startedAt", proof.startedAt));
        Vault.write(this, state);
      }
      open(proof.url());
    } catch (Exception unreadable) {
      status = "Couldn’t save a secure request. Forget local storage and try again.";
      render();
    }
  }

  private void render() {
    ScrollView scroll = new ScrollView(this);
    scroll.setBackgroundColor(Color.rgb(24, 25, 21));
    scroll.setFillViewport(true);
    content = new LinearLayout(this);
    content.setOrientation(LinearLayout.VERTICAL);
    content.setPadding(dp(24), dp(24), dp(24), dp(32));
    scroll.addView(content);
    setContentView(scroll);
    // Preserve readable controls below system bars on modern edge-to-edge Android targets.
    scroll.setOnApplyWindowInsetsListener(
        (view, insets) -> {
          android.graphics.Insets bars =
              android.os.Build.VERSION.SDK_INT >= 30
                  ? insets.getInsets(android.view.WindowInsets.Type.systemBars())
                  : null;
          view.setPadding(
              0,
              bars == null ? insets.getSystemWindowInsetTop() : bars.top,
              0,
              bars == null ? insets.getSystemWindowInsetBottom() : bars.bottom);
          return insets;
        });
    TextView title = text("Worth widgets", 32, paper);
    if (android.os.Build.VERSION.SDK_INT >= 28) title.setAccessibilityHeading(true);
    text(
        "Names, types and saved order from collections you approve. Notes, photos and visit details"
            + " stay in the website.",
        16,
        paper);
    text("Names can be visible to anyone who sees your home screen.", 14, muted);
    JSONObject state = null;
    try {
      state = Vault.read(this);
    } catch (Exception unreadable) {
      text("Device storage is unreadable. Forget this phone’s copy to reconnect.", 16, paper);
    }
    if (state != null) {
      JSONObject credential = state.optJSONObject("credential");
      if (credential == null) {
        button("Connect collections in browser", this::connect);
        JSONObject pending = state.optJSONObject("pending");
        if (pending != null && pending.has("code"))
          button(
              "Retry connection",
              () ->
                  run(
                      () -> {
                        WidgetClient.exchange(this);
                        WidgetClient.refresh(this);
                      },
                      "Connected and updated."));
      } else {
        text(
            "Expires "
                + DateFormat.getDateTimeInstance()
                    .format(new Date(credential.optLong("expiresAt"))),
            14,
            muted);
        button("Refresh now", () -> run(() -> WidgetClient.refresh(this), "Updated."));
        JSONObject snapshot = Vault.snapshot(state);
        if (snapshot != null) choices(state, snapshot);
        button(
            "Revoke widget access",
            () -> run(() -> WidgetClient.revoke(this), "Widget access revoked."));
      }
    }
    if (!status.isEmpty()) {
      TextView message = text(status, 16, paper);
      message.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
    }
    button(
        "Forget on this phone",
        () ->
            new AlertDialog.Builder(this)
                .setTitle("Forget on this phone?")
                .setMessage(
                    "Clears local credentials and saved names. This does not revoke server access;"
                        + " revoke any remaining connection in website Settings.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton(
                    "Forget",
                    (dialog, which) ->
                        run(
                            () -> {
                              Vault.clear(this);
                              WorthWidget.updateAll(this);
                            },
                            "Removed from this phone."))
                .show());
    button("Open Worth", () -> open(Proof.ORIGIN));
    button("Manage connections on website", () -> open(Proof.ORIGIN + "/settings"));
    text(
        "These choices apply to all Worth widgets on this device. Add Capture, Shortlist or Saved"
            + " find in your home screen’s widget picker. Disconnect before changing accounts;"
            + " website sign-out does not revoke widgets.",
        14,
        muted);
  }

  private void choices(JSONObject state, JSONObject snapshot) {
    JSONArray collections = snapshot.optJSONArray("collections");
    if (collections == null) return;
    text("Collection for widgets", 20, paper);
    RadioGroup group = new RadioGroup(this);
    content.addView(group);
    String selected = state.optString("collection");
    for (int i = 0; i < collections.length(); i++) {
      JSONObject collection = collections.optJSONObject(i);
      if (collection == null) continue;
      String id = collection.optString("id");
      RadioButton radio = new RadioButton(this);
      radio.setText(collection.optString("name"));
      radio.setTextColor(paper);
      radio.setMinHeight(dp(48));
      radio.setId(View.generateViewId());
      radio.setEnabled(!busy);
      group.addView(radio);
      radio.setChecked(id.equals(selected));
      radio.setOnClickListener(
          v ->
              run(
                  () -> {
                    synchronized (Vault.LOCK) {
                      JSONObject current = Vault.read(this);
                      Vault.write(this, current.put("collection", id));
                    }
                    WorthWidget.updateAll(this);
                  },
                  "Collection selected."));
    }
    text("Saved find group", 20, paper);
    String[] labels = {"All saved items", "Want to try", "Revisit queue", "Favorites"},
        filters = {"all", "want", "queue", "favorites"};
    RadioGroup finds = new RadioGroup(this);
    content.addView(finds);
    for (int i = 0; i < filters.length; i++) {
      final String filter = filters[i];
      RadioButton radio = new RadioButton(this);
      radio.setText(labels[i]);
      radio.setTextColor(paper);
      radio.setMinHeight(dp(48));
      radio.setId(View.generateViewId());
      radio.setEnabled(!busy);
      finds.addView(radio);
      radio.setChecked(filter.equals(Vault.filter(state)));
      radio.setOnClickListener(
          v ->
              run(
                  () -> {
                    synchronized (Vault.LOCK) {
                      JSONObject current = Vault.read(this);
                      Vault.clearSnapshot(current);
                      Vault.write(this, current.put("filter", filter));
                    }
                    WorthWidget.updateAll(this);
                    WidgetClient.refresh(this);
                  },
                  "Saved-find group updated."));
    }
    text(
        "Saved "
            + DateFormat.getDateTimeInstance().format(new Date(snapshot.optLong("updatedAt")))
            + ". Refreshes and local redraws depend on Android. Copies older than 24 hours or"
            + " access expiry are discarded on the next redraw.",
        14,
        muted);
  }
}
