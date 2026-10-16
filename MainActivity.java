package media.rolecredits.studio;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;
import android.graphics.drawable.GradientDrawable;
import android.database.Cursor;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Branded offline-first Role Credits host, with native Android import/export. */
public final class MainActivity extends Activity {
    private static final String ORIGIN="https://appassets.androidplatform.net/";
    private static final int REQUEST_PICK_FILE=2001, REQUEST_SAVE_FILE=2002, REQUEST_IMPORT=2003;
    private WebView web;
    private android.webkit.ValueCallback<Uri[]> chooser;
    private byte[] pendingExport;

    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(7,28,53));
        getWindow().setNavigationBarColor(Color.rgb(7,28,53));
        LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(7,28,53));
        setContentView(root);

        LinearLayout toolbar=new LinearLayout(this); toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(12),dp(3),dp(8),dp(3));
        GradientDrawable barBg=new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,new int[]{Color.rgb(5,25,49), Color.rgb(11,51,79)});
        toolbar.setBackground(barBg);
        ImageView brand=new ImageView(this); brand.setImageResource(R.mipmap.ic_launcher);
        brand.setScaleType(ImageView.ScaleType.FIT_CENTER);
        toolbar.addView(brand,new LinearLayout.LayoutParams(dp(36),dp(36)));
        TextView title=new TextView(this); title.setText("ROLE CREDITS  ✦  STUDIO"); title.setTextColor(Color.rgb(255,234,147));
        title.setTextSize(13); title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);title.setLetterSpacing(.055f);title.setPadding(dp(9),0,0,0);
        toolbar.addView(title,new LinearLayout.LayoutParams(0,dp(46),1)); title.setGravity(Gravity.CENTER_VERTICAL);
        TextView menu=new TextView(this); menu.setText("⋮");menu.setGravity(Gravity.CENTER);
        menu.setTextSize(25);menu.setTextColor(Color.WHITE);
        menu.setContentDescription("Role Credits app menu, export, import, updates");
        toolbar.addView(menu,new LinearLayout.LayoutParams(dp(45),dp(46)));
        root.addView(toolbar,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));
        menu.setOnClickListener(v->showMenu(menu));

        web=new WebView(this);
        root.addView(web,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1));
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);
        s.setBuiltInZoomControls(false);s.setDisplayZoomControls(false);
        s.setDefaultTextEncodingName("utf-8");
        s.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(false);
        web.addJavascriptInterface(new NativeBridge(),"RoleCreditsAndroid");
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params){
                if(chooser!=null)chooser.onReceiveValue(null);
                chooser=callback;
                Intent pick=new Intent(Intent.ACTION_GET_CONTENT);pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                String[] accepted=params.getAcceptTypes();
                if(accepted!=null && accepted.length>0 && accepted[0]!=null && !accepted[0].isEmpty() && !accepted[0].startsWith("."))pick.setType(accepted[0]);
                try{startActivityForResult(Intent.createChooser(pick,"Choose Role Credits file"),REQUEST_PICK_FILE);}
                catch(ActivityNotFoundException e){chooser.onReceiveValue(null);chooser=null; return false;}
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                Uri url=request.getUrl();
                if(ORIGIN.equals(url.getScheme()+"://"+url.getAuthority()+"/"))return false;
                openExternal(url);return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri url=request.getUrl();
                if(!ORIGIN.equals(url.getScheme()+"://"+url.getAuthority()+"/"))return null;
                String path=url.getPath();
                if(path==null||path.equals("/"))path="/index.html";
                if(path.contains("..")||path.indexOf('\0')>=0)return new WebResourceResponse("text/plain","utf-8",404,"Not found",java.util.Collections.emptyMap(),new java.io.ByteArrayInputStream(new byte[0]));
                String asset=path.startsWith("/")?path.substring(1):path;
                try{
                    InputStream data=getAssets().open(asset);
                    String mime=asset.endsWith(".html")?"text/html":asset.endsWith(".json")?"application/json":asset.endsWith(".png")?"image/png":"application/octet-stream";
                    return new WebResourceResponse(mime,"utf-8",data);
                } catch(IOException e){return new WebResourceResponse("text/plain","utf-8",new java.io.ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));}
            }
        });
        if(state!=null)web.restoreState(state);else web.loadUrl(ORIGIN+"index.html");
    }
    private void openExternal(Uri uri){
        try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){Toast.makeText(this,"No app to open link",Toast.LENGTH_SHORT).show();}
    }
    private void showMenu(View anchor){
        PopupMenu pm=new PopupMenu(this,anchor);
        pm.getMenu().add(0,1,0,"Export campaign backup");
        pm.getMenu().add(0,2,1,"Import campaign backup");
        pm.getMenu().add(0,3,2,"Check mobile updates");
        pm.getMenu().add(0,4,3,"Reload app");
        pm.getMenu().add(0,5,4,"About · v0.2.4.5");
        pm.setOnMenuItemClickListener(item->{switch(item.getItemId()){
            case 1:web.evaluateJavascript("downloadData()",null);return true;
            case 2:openImport();return true;
            case 3:openExternal(Uri.parse("https://github.com/deathboundchronicles-dev/Role-Credits-/releases"));return true;
            case 4:web.reload();return true;
            case 5:new android.app.AlertDialog.Builder(this).setTitle("Role Credits Studio")
                .setMessage("Android v0.2.4.5 · Offline character sheets and physical dice.\n\nUse Export campaign backup before uninstalling or switching devices. APK updates retain your data when installed with the same signing key.")
                .setPositiveButton("Got it",null).show();return true;
        }return false;});
        pm.show();
    }
    private void openImport(){
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT); intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try{startActivityForResult(intent,REQUEST_IMPORT);}catch(Exception e){Toast.makeText(this,"File picker unavailable",Toast.LENGTH_SHORT).show();}
    }
    private class NativeBridge{
        @JavascriptInterface public void saveTextFile(String name,String json){
            if(json==null||json.length()>20_000_000) return;
            byte[] data=json.getBytes(StandardCharsets.UTF_8);
            runOnUiThread(()->{
                if(pendingExport!=null){Toast.makeText(MainActivity.this,"Finish the previous export first",Toast.LENGTH_SHORT).show();return;}
                pendingExport=data;
                String safe=(name==null?"Role_Credits_Backup.json":name).replaceAll("[^A-Za-z0-9._-]","_");
                Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");i.putExtra(Intent.EXTRA_TITLE,safe);
                try{startActivityForResult(i,REQUEST_SAVE_FILE);}catch(Exception e){pendingExport=null;Toast.makeText(MainActivity.this,"Save location unavailable",Toast.LENGTH_SHORT).show();}
            });
        }
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==REQUEST_PICK_FILE){
            if(chooser!=null){Uri[] result=(resultCode==RESULT_OK&&data!=null&&data.getData()!=null)?new Uri[]{data.getData()}:null;chooser.onReceiveValue(result);chooser=null;}
        } else if(requestCode==REQUEST_SAVE_FILE){
            if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null&&pendingExport!=null){
                try(OutputStream stream=getContentResolver().openOutputStream(data.getData())){
                    if(stream!=null){stream.write(pendingExport);Toast.makeText(this,"Role Credits backup saved",Toast.LENGTH_LONG).show();}
                }catch(Exception e){Toast.makeText(this,"Could not save backup",Toast.LENGTH_LONG).show();}
            }
            pendingExport=null;
        } else if(requestCode==REQUEST_IMPORT&&resultCode==RESULT_OK&&data!=null&&data.getData()!=null){
            // Let the existing in-app JSON parser validate and migrate the file, never mutate storage natively.
            try(InputStream input=getContentResolver().openInputStream(data.getData())){
                if(input==null)return;
                ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] block=new byte[8192];int n;int max=20_000_000;
                while((n=input.read(block))!=-1){out.write(block,0,n);if(out.size()>max)throw new IOException("File too large");}
                byte[] bytes=out.toByteArray();
                String base64=android.util.Base64.encodeToString(bytes,android.util.Base64.NO_WRAP);
                String js="(function(){var s=atob('"+base64+"');var a=Uint8Array.from(s,c=>c.charCodeAt(0));var f=new File([a],'Role_Credits_Backup.json',{type:'application/json'});importData({target:{files:[f]}});})()";
                web.evaluateJavascript(js,null);
            }catch(Exception e){Toast.makeText(this,"Could not import backup: "+e.getMessage(),Toast.LENGTH_LONG).show();}
        }
    }
    @Override protected void onSaveInstanceState(Bundle out){web.saveState(out);super.onSaveInstanceState(out);}
    @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){if(web!=null)web.destroy();super.onDestroy();}
}
