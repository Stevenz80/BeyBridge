import React, { Children } from 'react';
import type { ReactNode } from 'react';
import { Text as NativeText } from 'react-native';
import type { TextProps } from 'react-native';
import { useLocalization } from '@/providers/LocalizationProvider';

function localizeChildren(children: ReactNode, t: (text: string) => string): ReactNode {
  const values = Children.toArray(children);
  if (values.every((value) => typeof value === 'string' || typeof value === 'number')) {
    return t(values.join(''));
  }

  return values.map((value, index) =>
    typeof value === 'string' ? <React.Fragment key={index}>{t(value)}</React.Fragment> : value
  );
}

// `lang` is a web-only attribute that React Native's types do not declare.
export default function Text({ children, lang, ...props }: TextProps & { lang?: string }) {
  const { locale, t } = useLocalization();
  const webLanguage = { lang: lang ?? (locale === 'ar' ? 'ar' : 'en') } as object;
  return (
    <NativeText {...props} {...webLanguage}>
      {localizeChildren(children, t)}
    </NativeText>
  );
}
