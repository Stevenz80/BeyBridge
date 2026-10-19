import { Alert, type AlertButton, type AlertOptions } from 'react-native';

type Translate = (text: string) => string;

// Alerts are shown from event handlers and providers, outside the localized Text
// components, so LocalizationProvider registers the current translator here.
let activeTranslate: Translate = (text) => text;

export function setAlertTranslator(translate: Translate) {
  activeTranslate = translate;
}

export function translateForAlert(text: string) {
  return activeTranslate(text);
}

// Alert.alert with the title, message and button labels in the app language.
export function showAlert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
  Alert.alert(
    activeTranslate(title),
    message === undefined ? undefined : activeTranslate(message),
    buttons?.map((button) => ({ ...button, text: button.text === undefined ? undefined : activeTranslate(button.text) })),
    options
  );
}
