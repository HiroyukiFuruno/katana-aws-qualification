# アカウント削除（#22）

## 契約

`POST /delete-account` は空のbodyだけを受け付ける。ブラウザは確認開始時に表示中のaccount IDを捕捉し、access tokenで`getUser(token)`をオンライン検証して一致した場合だけリクエストする。serverはBearer tokenを`/auth/v1/user`で再検証し、返されたsubjectだけをservice roleでhard deleteする。期待ID、`userId`、対象identityはserverへ送らない。

削除後は管理APIで同じsubjectを再取得し、404の場合だけ成功とする。成功後にブラウザはlocal scopeでsign outする。#23で追加するユーザー所有データは`auth.users(id) on delete cascade`で同じ削除に従わせる。

## 脅威境界と配備

- `Origin`は`KAQ_APP_ORIGIN`との完全一致だけを許可し、`OPTIONS`も同じCORS境界で返す。POST以外・body・トークンなしは拒否する。
- service role keyはEdge Functionの環境変数だけに置く。ブラウザ、レスポンス、ログ、テスト証跡には出さない。ブラウザの`key`は公開関数キーだけである。
- Edge handlerはbuiltinの`SUPABASE_URL`と`SUPABASE_SERVICE_ROLE_KEY`だけを必要とし、production Originは`https://kaq.katana-projects.org`に固定する。Bun test serverだけがconstructorへlocalhost Originを与える。ブラウザendpointはproductionでHTTPSに限定し、実handler検査だけはloopback HTTPを許可する。配備とFunction URLのruntime注入はroot担当であり、実ユーザー削除は実行しない。
- `supabase/config.toml`の`functions.delete-account.verify_jwt=true`でプラットフォームのJWT検証を維持する。その上でhandlerがオンライン本人確認し、失効・削除済みユーザーを受け付けない。公開キーだけでは本人確認を通過しない。

## DoD と検証

- handler unitは本人subject以外をdelete URLに使えないこと、foreign origin/bodyをAuth呼出し前に拒否すること、admin再取得404を必須にすることをHTTP mockで検証する。
- 実ITは実GoTrue、実handler、名前付き使い捨てtest userだけで実施する。テスト配線と起動はrootが追加し、production user・fake Auth・独自JWTは使わない。

## 配備・公開検査

レビュー済みのmainをexportし、公式Supabase CLIの`functions deploy delete-account --remote=vawysutvqmtxthbtflsu --use-api`を実行する。管理tokenはKeychainから子プロセスの環境変数へだけ渡す。`--no-verify-jwt`と`--prune`は使わない。公開後は未認証・無効token・別Originの拒否と、正しいOriginのpreflightを確認する。本番の本人アカウントを削除して検証しない。

参考: https://supabase.com/docs/guides/functions/auth-headers
