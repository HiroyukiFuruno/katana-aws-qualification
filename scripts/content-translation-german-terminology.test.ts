import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

const source = '担当者またはソフトウェアエージェントへ処理を渡す。';

test('German Agent uses weak declension after observed oblique articles', () => {
  for (const translated of [
    'Installieren Sie einen Agent zur Paketerfassung.',
    'Ohne einen Agent hinzuzufügen.',
    'Anstelle des Agent nur Verwaltungsereignisse aktivieren.',
    'Die von einem Agent angeforderte zusätzliche Eingabe.',
    'Die Anweisungen des Agent werden nicht geändert.',
    'Bei der Implementierung eines Agent sind die Einstellungen getrennt.',
    'Bei einem Agent auf AgentCore Runtime wird der Pfad beobachtbar.',
    'Die Ergebnisse übergeben, statt sie einem Agent zu überlassen.',
    'An einen verfügbaren Agent weiterleiten.',
    'Den Weg bis zum Agent verwalten.',
    'Die Anweisungen dem Agent übergeben.',
    'Den Agent die Antwort ableiten lassen.',
    'Dem Agent nur genehmigte Wissensdatenbanken zuordnen.',
    'Das Verhalten eines Agents untersuchen.',
    'Die Einstellungen für den Start des Agents prüfen.',
    'Die Installation eines eigenen Agents ist nicht zulässig.',
  ])
    expect(() => validateTranslation(source, translated, 'de', 'fixture')).toThrow(
      'German Agent declension',
    );
  expect(() =>
    validateTranslation(
      source,
      'An einen verfügbaren Agent weiterleiten.'.normalize('NFD'),
      'de',
      'fixture',
    ),
  ).toThrow('German Agent declension');
});

test('German Agent nominatives, inflected nouns and code identifiers remain valid', () => {
  for (const translated of [
    'Der Agent verarbeitet die Anfragen.',
    'An einen verfügbaren Agenten weiterleiten.',
    'Die Anweisungen des Agenten werden nicht geändert.',
    'Den Weg bis zum Agenten verwalten.',
    'Die Ergebnisse einem Agenten überlassen.',
    'Mit einem AgentCore-Agenten verbinden.',
    'Die Einstellungen dem Agent-Prozess übergeben.',
    'Die Eigenschaft eines `Agent`-Objekts auslesen.',
    'Die Eigenschaft eines Agent.handler-Objekts auslesen.',
    'Die Installation eines eigenen Agenten ist nicht zulässig.',
    'Die Konfiguration mit dem AppConfig Agent abrufen.',
    'Den Speicher mit dem CloudWatch Agent erfassen.',
    'Den SSM Agent ausführen.',
    'Den Pod Identity Agent installieren.',
    'An einen Amazon Bedrock Agents Classic-Agenten weiterleiten.',
  ])
    expect(() => validateTranslation(source, translated, 'de', 'fixture')).not.toThrow();
});
