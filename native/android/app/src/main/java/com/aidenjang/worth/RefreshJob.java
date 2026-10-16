package com.aidenjang.worth;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

public final class RefreshJob extends JobService {
  static void schedule(Context context, long delay) {
    JobScheduler scheduler = context.getSystemService(JobScheduler.class);
    if (scheduler != null)
      scheduler.schedule(
          new JobInfo.Builder(8616, new ComponentName(context, RefreshJob.class))
              .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
              .setMinimumLatency(delay)
              .build());
  }

  @Override
  public boolean onStartJob(JobParameters params) {
    WidgetClient.WORK.execute(
        () -> {
          try {
            WidgetClient.refresh(getApplicationContext());
          } catch (Exception unavailable) {
            WorthWidget.updateAll(getApplicationContext());
          }
          jobFinished(params, false);
          if (WorthWidget.hasWidgets(this)) schedule(this, 900000);
        });
    return true;
  }

  @Override
  public boolean onStopJob(JobParameters params) {
    return false;
  }
}
