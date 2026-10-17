package media.rolecredits.studio;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/** Single-file, read-only content URI for Android's native package installer. */
public final class UpdateApkProvider extends ContentProvider {
    public static final String APK_NAME = "Role_Credits_Android.apk";

    public static File updateFile(android.content.Context ctx) {
        return new File(new File(ctx.getFilesDir(), "updates"), APK_NAME);
    }

    public static Uri updateUri(android.content.Context ctx) {
        return new Uri.Builder().scheme("content")
                .authority(ctx.getPackageName() + ".updates")
                .appendPath(APK_NAME).build();
    }

    private boolean isAllowed(Uri uri) {
        return uri != null && uri.getPathSegments().size() == 1
                && APK_NAME.equals(uri.getLastPathSegment());
    }

    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) {
        return isAllowed(uri) ? "application/vnd.android.package-archive" : null;
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection,
                                  String[] selectionArgs, String sortOrder) {
        if (!isAllowed(uri)) return null;
        File apk = updateFile(getContext());
        MatrixCursor cursor = new MatrixCursor(new String[] {
                OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE
        });
        cursor.addRow(new Object[] { APK_NAME, apk.exists() ? apk.length() : 0L });
        return cursor;
    }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!isAllowed(uri) || !"r".equals(mode)) throw new FileNotFoundException("Read only APK URI");
        File file = updateFile(getContext());
        if (!file.isFile() || file.length() == 0) throw new FileNotFoundException("APK not ready");
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { throw new UnsupportedOperationException(); }
}
