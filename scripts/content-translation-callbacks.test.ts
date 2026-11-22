import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

test('payment callback translation preserves an application notification rather than a reminder', () => {
  expect(() =>
    validateTranslation(
      '決済コールバックが注文IDを送信する。',
      'Des rappels de paiement envoient un ID.',
      'fr',
      'fixture',
    ),
  ).toThrow('callback terminology');
  expect(() =>
    validateTranslation(
      '決済コールバックが注文IDを送信する。',
      'Zahlungsrückrufe senden eine Bestell-ID.',
      'de',
      'fixture',
    ),
  ).toThrow('callback terminology');
  expect(() =>
    validateTranslation(
      '決済コールバックが注文IDを送信する。',
      'Les callbacks de paiement transmettent un ID de commande.',
      'fr',
      'fixture',
    ),
  ).not.toThrow();
  expect(() =>
    validateTranslation(
      '決済コールバックが注文IDを送信する。',
      'Callbacks für Zahlungen senden eine Bestell-ID.',
      'de',
      'fixture',
    ),
  ).not.toThrow();
});

test('real payment reminders and generic callback functions retain their own terminology', () => {
  expect(() =>
    validateTranslation(
      '支払期日の前に督促を送る。',
      'Envoyer des rappels de paiement.',
      'fr',
      'fixture',
    ),
  ).not.toThrow();
  expect(() =>
    validateTranslation(
      'コールバック関数を登録する。',
      'Enregistrer une fonction de rappel.',
      'fr',
      'fixture',
    ),
  ).not.toThrow();
});
