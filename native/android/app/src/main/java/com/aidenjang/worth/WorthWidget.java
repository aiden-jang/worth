package com.aidenjang.worth;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import java.text.DateFormat;
import java.util.Date;
import org.json.JSONArray;
import org.json.JSONObject;

public class WorthWidget extends AppWidgetProvider {
  public static class Capture extends WorthWidget {}

  public static class Shortlist extends WorthWidget {}

  public static class Find extends WorthWidget {}

  private static final Class<?>[] PROVIDERS = {Capture.class, Shortlist.class, Find.class};

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    updateAll(context);
    RefreshJob.schedule(context, 0);
  }

  @Override
  public void onReceive(Context context, Intent intent) {
    super.onReceive(context, intent);
    if ("com.aidenjang.worth.EXPIRE".equals(intent.getAction())) updateAll(context);
  }

  static boolean hasWidgets(Context context) {
    for (Class<?> provider : PROVIDERS)
      if (AppWidgetManager.getInstance(context)
              .getAppWidgetIds(new ComponentName(context, provider))
              .length
          > 0) return true;
    return false;
  }

  static void updateAll(Context context) {
    JSONObject state;
    try {
      state = Vault.read(context);
    } catch (Exception unreadable) {
      state = new JSONObject();
    }
    JSONObject snapshot = Vault.snapshot(state), chosen = null;
    if (snapshot != null) {
      JSONArray collections = snapshot.optJSONArray("collections");
      if (collections != null)
        for (int i = 0; i < collections.length(); i++) {
          JSONObject entry = collections.optJSONObject(i);
          if (entry != null && entry.optString("id").equals(state.optString("collection")))
            chosen = entry;
        }
    }
    for (Class<?> provider : PROVIDERS) {
      int[] ids =
          AppWidgetManager.getInstance(context)
              .getAppWidgetIds(new ComponentName(context, provider));
      for (int id : ids) render(context, id, provider, chosen, snapshot);
    }
    // A local redraw can remove stale names without a network request. Android may delay alarms.
    if (snapshot != null) {
      long expiry =
          Math.min(snapshot.optLong("expiresAt"), snapshot.optLong("updatedAt") + 86400000);
      AlarmManager alarms = context.getSystemService(AlarmManager.class);
      if (alarms != null)
        alarms.setAndAllowWhileIdle(
            AlarmManager.RTC,
            expiry,
            PendingIntent.getBroadcast(
                context,
                8617,
                new Intent(context, Capture.class).setAction("com.aidenjang.worth.EXPIRE"),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }
  }

  private static void render(
      Context context, int id, Class<?> provider, JSONObject chosen, JSONObject snapshot) {
    boolean capture = provider == Capture.class, find = provider == Find.class;
    String heading = "worth / " + (capture ? "capture" : find ? "saved find" : "shortlist");
    String title = "Choose a collection",
        text = "Open the Worth companion to connect or refresh.",
        footer = "",
        url = null;
    if (chosen != null && snapshot != null) {
      title = chosen.optString("name");
      url = Proof.ORIGIN + "/lists/" + Uri.encode(chosen.optString("id"));
      footer =
          "Saved "
              + DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT)
                  .format(new Date(snapshot.optLong("updatedAt")));
      if (capture) {
        text = "+ Keep a name\nOpens capture in Worth.";
        url += "?capture=1";
      } else if (find) {
        JSONObject item = chosen.optJSONObject("find");
        if (item == null) text = "No items in this saved-find group.";
        else {
          text =
              item.optString("title")
                  + (item.optString("type").isEmpty() ? "" : "\n" + item.optString("type"));
          url += "?focus=" + Uri.encode("item:" + item.optString("id"));
        }
      } else {
        JSONArray ranked = chosen.optJSONArray("ranked");
        StringBuilder rows = new StringBuilder();
        if (ranked != null)
          for (int i = 0; i < Math.min(5, ranked.length()); i++) {
            JSONObject item = ranked.optJSONObject(i);
            if (item != null) {
              if (rows.length() > 0) rows.append('\n');
              rows.append(item.optInt("rank")).append(". ").append(item.optString("title"));
            }
          }
        text = rows.length() == 0 ? "No ranked items yet." : rows.toString();
      }
    }
    RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.worth_widget);
    view.setTextViewText(R.id.widget_heading, heading);
    view.setTextViewText(R.id.widget_title, title);
    view.setTextViewText(R.id.widget_content, text);
    view.setTextViewText(R.id.widget_footer, footer);
    view.setContentDescription(R.id.widget_content, text);
    Intent intent =
        url == null
            ? new Intent(context, MainActivity.class)
            : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    view.setOnClickPendingIntent(
        R.id.widget_root,
        PendingIntent.getActivity(
            context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    AppWidgetManager.getInstance(context).updateAppWidget(id, view);
  }
}
