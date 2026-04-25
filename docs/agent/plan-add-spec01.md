# 実装計画書 — add-spec01.md 対応

作成日: 2026-04-25  
参照仕様: `/workspace/docs/user/add-spec01.md`

---

## 概要

`add-spec01.md` に記載された追加仕様 5 件・懸念事項 2 件を実装する計画書です。  
各項目の現状・変更範囲・実装方針を示します。

---

## 追加仕様

### 1. 同一URLへの問題追加機能

**現状**  
- `quiz.generate` は毎回新しい `quizId` を発行し、独立した新クイズを作成する。

**変更範囲**  
| レイヤ | ファイル |
|---|---|
| API | `packages/api/src/routers/quiz.ts` |
| Web (生成画面) | `apps/web/src/routes/quiz.generating.tsx` |
| Web (クイズ詳細) | `apps/web/src/routes/quiz.$quizId.tsx` または detail ページ |

**実装方針**  
1. `quiz.generate` API に `appendToQuizId?: string` パラメータを追加する。
2. `appendToQuizId` が指定されている場合は新しい `quiz` レコードを作らず、既存クイズに `quizQuestion` / `quizChoice` を追記する。また `quiz.questionCount` を更新する。
3. ダッシュボードのクイズカードに「問題を追加」ボタンを設置し、`/quiz/generating?url=<既存URL>&appendToQuizId=<id>` へ遷移させる。
4. `quiz.generating.tsx` では `appendToQuizId` がある場合はその旨を表示し、完了後に該当クイズ画面へ遷移する。

---

### 2. 問題一覧のソート機能

**現状**  
- `quiz.list` は常に `ORDER BY createdAt DESC` 固定。

**変更範囲**  
| レイヤ | ファイル |
|---|---|
| API | `packages/api/src/routers/quiz.ts` |
| Web (ダッシュボード) | `apps/web/src/routes/dashboard.tsx` |

**実装方針**  
1. `quiz.list` の input に `sortBy` (例: `"createdAt" | "title" | "bestScore" | "attemptCount"`)と `sortOrder` (`"asc" | "desc"`) を追加する。
2. API 側で `sortBy` に応じて `orderBy` 句を切り替える。
3. ダッシュボード UI にソートセレクターを追加する（例: 「新着順」「タイトル順」「ベストスコア順」「プレイ回数順」）。

---

### 3. 記事の分量から問題数を自動設定する機能

**現状**  
- 問題数はユーザーが手動入力（Landing ページは固定 5 問）。

**変更範囲**  
| レイヤ | ファイル |
|---|---|
| API | `packages/api/src/routers/quiz.ts` |
| Web (Landing / 生成フロー) | `apps/web/src/routes/index.tsx`, `apps/web/src/routes/quiz.generating.tsx` |

**実装方針**  
1. `quiz.generate` に `autoQuestionCount: boolean` パラメータを追加する。
2. `autoQuestionCount === true` の場合、`fetchPageContent` で取得したテキスト文字数をもとに問題数を決定する。  
   目安: `~2000字 → 3問 / ~5000字 → 5問 / ~10000字 → 8問 / 10000字超 → 10問`
3. フロントエンドのクイズ生成フォームに「自動設定」チェックボックスを追加し、チェック時は問題数入力欄をグレーアウトする。

---

### 4. クイズ生成言語の選択

**現状**  
- AI プロンプトが日本語固定。

**変更範囲**  
| レイヤ | ファイル |
|---|---|
| API | `packages/api/src/routers/quiz.ts` |
| DB Schema | `packages/db/src/schema/quiz.ts` (カラム追加) + マイグレーション |
| Web (生成画面) | `apps/web/src/routes/quiz.generating.tsx`, `apps/web/src/routes/index.tsx` |

**実装方針**  
1. `quiz` テーブルに `language text NOT NULL DEFAULT 'ja'` カラムを追加しマイグレーションを作成する。
2. `generateQuestionsWithAi` に `language: string` 引数を追加し、systemPrompt の言語指示を切り替える。  
   例: `"ja" → 日本語で出力`, `"en" → Output in English`
3. `quiz.generate` API の input に `language: z.enum(["ja", "en", "zh", "ko"]).default("ja")` を追加する。
4. フロントエンドの生成フォームに言語セレクターを追加する（日本語 / English / 中文 / 한국어）。
5. `quiz.generating.tsx` の `validateSearch` に `language` を追加する。

---

### 5. TeX 表記の正しい表示

**現状**  
- 問題文・選択肢は plain text として表示しており、`$...$` や `$$...$$` のような TeX 記法が文字列のまま表示される。

**変更範囲**  
| レイヤ | ファイル |
|---|---|
| 依存パッケージ | `apps/web/package.json` |
| Web (クイズ画面) | `apps/web/src/routes/quiz.$quizId.index.tsx` |
| Web (復習画面) | `apps/web/src/routes/quiz.$quizId.review.tsx` |

**実装方針**  
1. `katex` および `react-katex`（または `@matejmazur/react-katex`）を `apps/web` に追加する。
2. `MathText` コンポーネントを作成し、テキスト中の `$...$` / `$$...$$` を KaTeX でレンダリングする。  
   - 正規表現で数式ブロックと通常テキストを分割し、数式部分のみ `<InlineMath>` / `<BlockMath>` に置き換える。
3. クイズ画面・復習画面の問題文・選択肢テキスト表示箇所で `MathText` コンポーネントを使用する。

---

## 懸念事項

### 1. レスポンシブ対応

**現状**  
- Landing ページ (`index.tsx`) には `@media` クラスが適用済み。  
- ダッシュボード・クイズ画面・結果画面などは未対応箇所が残っている。

**変更範囲**  
| ファイル | 対象 |
|---|---|
| `apps/web/src/routes/dashboard.tsx` | クイズカード一覧 / フィルタエリア |
| `apps/web/src/routes/quiz.$quizId.index.tsx` | 選択肢ボタン / 問題表示エリア |
| `apps/web/src/routes/quiz.$quizId.result.tsx` | スコア表示 |
| `apps/web/src/routes/quiz.$quizId.review.tsx` | 復習リスト |

**実装方針**  
- 各ページの inline style に `@media (max-width: 768px)` / `(max-width: 480px)` レスポンシブルールを追加する。  
- モバイルでは横幅いっぱいにカードやボタンを展開し、フォントサイズ・余白を調整する。

---

### 2. クイズ解答時の UX 改善（ローディング表示）

**現状**  
- `handleSelectChoice` で `setAnswering(true)` はしているが、選択した選択肢に視覚フィードバックがなく、APIレスポンスが返るまで画面が止まって見える。

**変更範囲**  
| レイヤ | ファイル |
|---|---|
| Web (クイズ画面) | `apps/web/src/routes/quiz.$quizId.index.tsx` |

**実装方針（ローディングアニメーション案を採用）**  
1. `answering === true` の間、選択した選択肢ボタンにスピナー or ローディングインジケーターを表示する。  
2. 具体的には: `selectedChoiceId` を state で保持し、クリック直後に該当ボタンのスタイルを「処理中」に変える（例: opacity 低下 + ミニスピナー表示）。  
3. API レスポンス後に通常の正誤フィードバック表示に切り替える。  
4. `answering` 中は全ての選択肢ボタンを `disabled` にし、二重送信を防ぐ（現在も `answering` チェックはあるが視覚的フィードバックがない）。

---

## 実装順序（推奨）

優先度・依存関係を考慮した順序:

| # | 項目 | 理由 |
|---|---|---|
| 1 | 懸念事項2: 解答時UX改善 | ユーザー体験への直接影響が大きく、変更範囲が小さい |
| 2 | 追加仕様5: TeX表示対応 | 依存パッケージ追加のみで他への影響が少ない |
| 3 | 追加仕様2: ソート機能 | API・UI両方に及ぶが独立した変更で影響範囲が明確 |
| 4 | 追加仕様3: 問題数自動設定 | APIロジックの追加のみで範囲が小さい |
| 5 | 追加仕様4: 言語選択 | DBマイグレーション・API・UI の3層変更が必要 |
| 6 | 追加仕様1: 問題追加機能 | DBへの書き込み変更を含み最も複雑 |
| 7 | 懸念事項1: レスポンシブ対応 | 複数ページにまたがり作業量が多い |

---

## テスト方針

各実装後に以下を確認する:

- API ルーターの unit test (`packages/api/src/__tests__/`) を追加・更新する
- フロントエンドの動作確認は手動テストで実施する
- DBマイグレーションが正常に適用されることを確認する (`bun run db:migrate`)
