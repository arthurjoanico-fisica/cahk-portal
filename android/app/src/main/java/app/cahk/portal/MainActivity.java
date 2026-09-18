package app.cahk.portal;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
  private WebView webView;
  private ValueCallback<Uri[]> fileCallback;
  private PermissionRequest pendingPermission;
  private static final int FILE_CHOOSER = 1001;
  private static final int AUDIO_PERMISSION = 1002;
  private static final String HOME = "https://cahk.app/";

  @Override public void onCreate(Bundle b) {
    super.onCreate(b);
    getWindow().setStatusBarColor(android.graphics.Color.rgb(17,16,21));
    getWindow().setNavigationBarColor(android.graphics.Color.rgb(17,16,21));
    webView = new WebView(this);
    setContentView(webView);
    WebSettings s=webView.getSettings();
    s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false); s.setAllowFileAccess(true); s.setAllowContentAccess(true);
    CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(webView,true);
    webView.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r){ return handleUrl(r.getUrl()); }
      @Override public boolean shouldOverrideUrlLoading(WebView v, String url){ return handleUrl(Uri.parse(url)); }
    });
    webView.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params){
        if(fileCallback!=null) fileCallback.onReceiveValue(null); fileCallback=cb;
        Intent i=params.createIntent(); try{startActivityForResult(i,FILE_CHOOSER);}catch(Exception e){fileCallback=null;return false;} return true;
      }
      @Override public void onPermissionRequest(PermissionRequest req){
        runOnUiThread(()->{
          for(String r:req.getResources()) if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)){
            if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED){req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});}
            else{pendingPermission=req;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},AUDIO_PERMISSION);} return;
          }
          req.deny();
        });
      }
    });
    if(b==null){ Uri deep=getIntent().getData(); webView.loadUrl(deep!=null&&"cahk.app".equalsIgnoreCase(deep.getHost())?deep.toString():HOME); }
    else webView.restoreState(b);
  }

  private boolean handleUrl(Uri u){
    String h=u.getHost(); String scheme=u.getScheme();
    if("https".equalsIgnoreCase(scheme)&&h!=null&&(h.equals("cahk.app")||h.endsWith(".cahk.app"))) return false;
    try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){} return true;
  }

  @Override protected void onActivityResult(int req,int result,Intent data){
    super.onActivityResult(req,result,data);
    if(req==FILE_CHOOSER&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}
  }
  @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){
    super.onRequestPermissionsResult(requestCode,permissions,grantResults);
    if(requestCode==AUDIO_PERMISSION&&pendingPermission!=null){if(grantResults.length>0&&grantResults[0]==PackageManager.PERMISSION_GRANTED)pendingPermission.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});else pendingPermission.deny();pendingPermission=null;}
  }
  @Override public void onBackPressed(){if(webView.canGoBack())webView.goBack();else super.onBackPressed();}
  @Override protected void onSaveInstanceState(Bundle out){webView.saveState(out);super.onSaveInstanceState(out);}
}
