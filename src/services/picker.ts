const PICKER_SRC = 'https://apis.google.com/js/api.js';

let pickerLoad: Promise<void> | null = null;

/**
 * Load the Google Picker API.
 *
 * The picker is how a `drive.file` grant is created: the token only authorises
 * files the user has explicitly picked (or the app created), so there is no way
 * to reach a spreadsheet by id alone. That is the point — it is what keeps this
 * app's token from being usable against every other sheet in the account.
 */
function loadPicker(): Promise<void> {
  if (pickerLoad) return pickerLoad;

  pickerLoad = new Promise((resolve, reject) => {
    const fail = () => {
      pickerLoad = null;
      reject(new Error('Could not load the Google file picker. Check your connection.'));
    };

    const script = document.createElement('script');
    script.src = PICKER_SRC;
    script.onerror = fail;
    script.onload = () => {
      try {
        gapi.load('picker', { callback: () => resolve(), onerror: fail });
      } catch {
        fail();
      }
    };
    document.head.appendChild(script);
  });

  return pickerLoad;
}

/**
 * Open the picker and return the chosen spreadsheet id, or null if cancelled.
 * Picking a file is what grants this app access to it.
 */
export async function pickSpreadsheet(
  accessToken: string,
  apiKey: string,
  appId: string,
): Promise<string | null> {
  await loadPicker();

  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS);
    view.setIncludeFolders(true);
    view.setSelectFolderEnabled(false);

    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      // Required with the drive.file scope: this is what ties the user's
      // selection to THIS app, creating the per-file grant. Without it the
      // picker still returns an id, but every API call for that file 404s.
      .setAppId(appId)
      .addView(view)
      .setTitle('Choose your finances spreadsheet')
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve(data.docs?.[0]?.id ?? null);
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}
