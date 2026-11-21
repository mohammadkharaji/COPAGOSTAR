package com.copagostar.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class CopaWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_REFRESH = "com.copagostar.widget.ACTION_REFRESH";
    private static final String API_URL = "https://copadash.amadehlaziz.com/api/mobile/widget-pulse";
    private static final String DASHBOARD_URL = "https://copadash.amadehlaziz.com/#overview";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        // The broadcast from updatePeriodMillis delivers both APPWIDGET_UPDATE and ACTION_REFRESH in onReceive;
        // one fetch for the whole provider instance is enough.
        fetchDataAndUpdate(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            fetchDataAndUpdate(context);
        }
    }

    static void refreshAll(Context context) {
        Intent refresh = new Intent(context, CopaWidgetProvider.class);
        refresh.setAction(ACTION_REFRESH);
        try {
            context.sendBroadcast(refresh);
        } catch (Exception ignored) {}
    }

    private static void bindIntents(Context context, RemoteViews views) {
        Intent refreshIntent = new Intent(context, CopaWidgetProvider.class);
        refreshIntent.setAction(ACTION_REFRESH);
        PendingIntent refreshPendingIntent = PendingIntent.getBroadcast(
                context, 0, refreshIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.btn_refresh, refreshPendingIntent);

        Intent openIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(DASHBOARD_URL));
        PendingIntent openPendingIntent = PendingIntent.getActivity(
                context, 1, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_container, openPendingIntent);
    }

    private static void fetchDataAndUpdate(Context context) {
        new Thread(() -> {
            try {
                URL url = new URL(API_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setRequestProperty("Accept", "application/json");
                // Widget credential issued by the dashboard; without it the API returns 401.
                String token = context.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE)
                        .getString(MainActivity.TOKEN, "");
                if (token != null && !token.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                }

                int code = conn.getResponseCode();
                StringBuilder response = new StringBuilder();
                if (code == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();
                    parseAndUpdateViews(context, response.toString());
                } else {
                    showError(context, code == 401 ? "توکن ویجت ثبت یا تمدید نشده" : "خطای سرور");
                }
                conn.disconnect();
            } catch (Exception e) {
                showError(context, "عدم اتصال به سرور");
            }
        }).start();
    }

    private static void parseAndUpdateViews(Context context, String jsonStr) {
        try {
            JSONObject json = new JSONObject(jsonStr);
            String timeNow = new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date());

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_layout);

            if (json.has("available") && !json.optBoolean("available")) {
                views.setTextViewText(R.id.txt_title, "نبض فروش");
                views.setTextViewText(R.id.txt_amount, json.optString("reason", "داده موجود نیست"));
                views.setTextViewText(R.id.txt_trend, "—");
                views.setTextViewText(R.id.txt_footer, toFaDigits(timeNow));
                bindIntents(context, views);
                push(context, views);
                return;
            }

            double actualRial = json.optDouble("actual_rial", json.optDouble("net_rial_vat", 0));
            long actualToman = Math.round(actualRial / 10.0);
            double targetPct = json.optDouble("target_achievement_pct", Double.NaN);
            int activeCust = json.optInt("active_customers_count", 0);
            int workingDays = json.optInt("working_days", 0);
            int elapsedDays = json.optInt("elapsed_working_days", 0);
            String asOfDate = json.optString("as_of_date", "");

            String dateText = toFaDigits(asOfDate) + (asOfDate.isEmpty() ? "" : " ، ") + toFaDigits(timeNow);
            String amountText = toFaCurrency(actualToman) + " تومان";

            views.setTextViewText(R.id.txt_date, dateText);
            views.setTextViewText(R.id.txt_title, "فروش محقق‌شده");
            views.setTextViewText(R.id.txt_amount, amountText);

            if (!Double.isNaN(targetPct)) {
                double diff = targetPct - 100.0;
                String trendText = (diff < 0 ? "↓ " : "↑ ") + toFaDigits(String.format(Locale.US, "%.0f", Math.abs(diff))) + "٪" + (diff < 0 ? "-" : "+");
                views.setTextViewText(R.id.txt_trend, trendText);
                views.setTextColor(R.id.txt_trend, diff < 0 ? 0xFFFB7185 : 0xFF34D399);
            } else {
                views.setTextViewText(R.id.txt_trend, "—");
            }

            String footerText = "تحقق: " + (Double.isNaN(targetPct) ? "—" : toFaDigits(String.format(Locale.US, "%.0f", targetPct)) + "٪")
                    + "   |   " + toFaCurrency(activeCust) + " خریدار"
                    + (workingDays > 0 ? "   |   " + toFaDigits(String.valueOf(elapsedDays)) + " از " + toFaDigits(String.valueOf(workingDays)) + " روز" : "");
            views.setTextViewText(R.id.txt_footer, footerText);

            bindIntents(context, views);
            push(context, views);
        } catch (Exception ignored) {
            showError(context, "پاسخ نامعتبر از سرور");
        }
    }

    /** Error state: the widget shows what went wrong instead of stale made-up numbers. */
    private static void showError(Context context, String message) {
        try {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_layout);
            String timeNow = new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date());
            views.setTextViewText(R.id.txt_date, toFaDigits(timeNow));
            views.setTextViewText(R.id.txt_title, "نبض فروش");
            views.setTextViewText(R.id.txt_amount, message);
            views.setTextViewText(R.id.txt_trend, "—");
            views.setTextColor(R.id.txt_trend, 0xFF94A3B8);
            views.setTextViewText(R.id.txt_footer, "برای اصلاح، برنامه Copa را باز کنید");
            bindIntents(context, views);
            push(context, views);
        } catch (Exception ignored) {}
    }

    private static void push(Context context, RemoteViews views) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, CopaWidgetProvider.class);
        manager.updateAppWidget(thisWidget, views);
    }

    public static String toFaDigits(String input) {
        if (input == null) return "";
        char[] fa = {'۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'};
        StringBuilder sb = new StringBuilder();
        for (char c : input.toCharArray()) {
            if (c >= '0' && c <= '9') {
                sb.append(fa[c - '0']);
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    public static String toFaCurrency(long number) {
        DecimalFormat df = new DecimalFormat("#,###");
        return toFaDigits(df.format(number));
    }
}