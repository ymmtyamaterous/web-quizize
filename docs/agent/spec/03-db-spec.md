# Web Quizize — データベース設計書

> 作成日: 2026-03-30  
> バージョン: 1.0.0  
> DBMS: SQLite（libsql / Turso）  
> ORM: Drizzle ORM

---

## 1. テーブル一覧

| テーブル名 | 説明 | 新規 / 既存 |
|-----------|------|------------|
| `user` | ユーザー情報 | 既存（better-auth） |
| `session` | 認証セッション | 既存（better-auth） |
| `account` | OAuthアカウント連携 | 既存（better-auth） |
| `verification` | メール確認トークン | 既存（better-auth） |
| `quiz` | 生成されたクイズ本体 | **新規** |
| `quiz_question` | クイズの各問題 | **新規** |
| `quiz_choice` | 問題の選択肢 | **新規** |
| `quiz_attempt` | クイズ挑戦セッション | **新規** |
| `quiz_attempt_answer` | 挑戦での個別回答記録 | **新規** |

---

## 2. ER 図

```
user (既存)
 │
 ├──< quiz (userId)
 │     │
 │     └──< quiz_question (quizId)
 │           │
 │           └──< quiz_choice (questionId)
 │
 └──< quiz_attempt (userId, quizId)
       │
       └──< quiz_attempt_answer (attemptId, questionId, selectedChoiceId)
```

---

## 3. テーブル定義（新規テーブル）

### 3.1 `quiz` — クイズ本体

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | — | PK（cuid / nanoid） |
| `user_id` | TEXT | NOT NULL | — | FK → `user.id` |
| `source_url` | TEXT | NOT NULL | — | クイズ元の URL |
| `source_title` | TEXT | NOT NULL | — | ページタイトル |
| `source_content` | TEXT | NOT NULL | — | 取得した生テキスト（参照用） |
| `difficulty` | TEXT | NOT NULL | `'medium'` | `easy` / `medium` / `hard` |
| `question_count` | INTEGER | NOT NULL | `5` | 生成された問題数 |
| `status` | TEXT | NOT NULL | `'generating'` | `generating` / `ready` / `failed` |
| `created_at` | INTEGER | NOT NULL | `unixepoch() * 1000` | 作成日時（timestamp_ms） |
| `updated_at` | INTEGER | NOT NULL | `unixepoch() * 1000` | 更新日時（timestamp_ms） |

**インデックス**

```sql
CREATE INDEX quiz_userId_idx ON quiz (user_id);
CREATE INDEX quiz_createdAt_idx ON quiz (created_at DESC);
```

**Drizzle スキーマ例**

```typescript
export const quiz = sqliteTable(
  "quiz",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    sourceContent: text("source_content").notNull(),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull().default("medium"),
    questionCount: integer("question_count").notNull().default(5),
    status: text("status", { enum: ["generating", "ready", "failed"] }).notNull().default("generating"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("quiz_userId_idx").on(table.userId),
    index("quiz_createdAt_idx").on(table.createdAt),
  ],
);
```

---

### 3.2 `quiz_question` — クイズ問題

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | — | PK |
| `quiz_id` | TEXT | NOT NULL | — | FK → `quiz.id` |
| `type` | TEXT | NOT NULL | — | `fill_blank` / `multiple_choice` |
| `sentence` | TEXT | NOT NULL | — | 問題文（`___` が空欄を示す） |
| `answer` | TEXT | NOT NULL | — | 正解の語句 |
| `explanation` | TEXT | NOT NULL | — | 解説テキスト |
| `order_index` | INTEGER | NOT NULL | — | 問題の表示順（0始まり） |
| `created_at` | INTEGER | NOT NULL | `unixepoch() * 1000` | 作成日時 |

**インデックス**

```sql
CREATE INDEX quiz_question_quizId_idx ON quiz_question (quiz_id);
```

**Drizzle スキーマ例**

```typescript
export const quizQuestion = sqliteTable(
  "quiz_question",
  {
    id: text("id").primaryKey(),
    quizId: text("quiz_id").notNull().references(() => quiz.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["fill_blank", "multiple_choice"] }).notNull(),
    sentence: text("sentence").notNull(),
    answer: text("answer").notNull(),
    explanation: text("explanation").notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("quiz_question_quizId_idx").on(table.quizId)],
);
```

---

### 3.3 `quiz_choice` — 選択肢

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | — | PK |
| `question_id` | TEXT | NOT NULL | — | FK → `quiz_question.id` |
| `text` | TEXT | NOT NULL | — | 選択肢テキスト |
| `is_correct` | INTEGER | NOT NULL | `0` | 正解フラグ（0/1） |
| `order_index` | INTEGER | NOT NULL | — | 表示順（0始まり） |

**インデックス**

```sql
CREATE INDEX quiz_choice_questionId_idx ON quiz_choice (question_id);
```

**Drizzle スキーマ例**

```typescript
export const quizChoice = sqliteTable(
  "quiz_choice",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id").notNull().references(() => quizQuestion.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
    orderIndex: integer("order_index").notNull(),
  },
  (table) => [index("quiz_choice_questionId_idx").on(table.questionId)],
);
```

---

### 3.4 `quiz_attempt` — 挑戦セッション

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | — | PK |
| `user_id` | TEXT | NOT NULL | — | FK → `user.id` |
| `quiz_id` | TEXT | NOT NULL | — | FK → `quiz.id` |
| `score` | INTEGER | NULL | `NULL` | 正答数（完了時に確定） |
| `total_questions` | INTEGER | NOT NULL | — | 問題総数 |
| `started_at` | INTEGER | NOT NULL | `unixepoch() * 1000` | 開始日時 |
| `completed_at` | INTEGER | NULL | `NULL` | 完了日時（未完了は NULL） |

**インデックス**

```sql
CREATE INDEX quiz_attempt_userId_idx ON quiz_attempt (user_id);
CREATE INDEX quiz_attempt_quizId_idx ON quiz_attempt (quiz_id);
CREATE INDEX quiz_attempt_completedAt_idx ON quiz_attempt (completed_at DESC);
```

**Drizzle スキーマ例**

```typescript
export const quizAttempt = sqliteTable(
  "quiz_attempt",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    quizId: text("quiz_id").notNull().references(() => quiz.id, { onDelete: "cascade" }),
    score: integer("score"),
    totalQuestions: integer("total_questions").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("quiz_attempt_userId_idx").on(table.userId),
    index("quiz_attempt_quizId_idx").on(table.quizId),
    index("quiz_attempt_completedAt_idx").on(table.completedAt),
  ],
);
```

---

### 3.5 `quiz_attempt_answer` — 個別回答記録

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | — | PK |
| `attempt_id` | TEXT | NOT NULL | — | FK → `quiz_attempt.id` |
| `question_id` | TEXT | NOT NULL | — | FK → `quiz_question.id` |
| `selected_choice_id` | TEXT | NOT NULL | — | FK → `quiz_choice.id`（選択した選択肢） |
| `is_correct` | INTEGER | NOT NULL | — | 正誤フラグ（0/1） |
| `answered_at` | INTEGER | NOT NULL | `unixepoch() * 1000` | 回答日時 |

**インデックス**

```sql
CREATE INDEX quiz_attempt_answer_attemptId_idx ON quiz_attempt_answer (attempt_id);
```

**Drizzle スキーマ例**

```typescript
export const quizAttemptAnswer = sqliteTable(
  "quiz_attempt_answer",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull().references(() => quizAttempt.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull().references(() => quizQuestion.id, { onDelete: "cascade" }),
    selectedChoiceId: text("selected_choice_id").notNull().references(() => quizChoice.id),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    answeredAt: integer("answered_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("quiz_attempt_answer_attemptId_idx").on(table.attemptId)],
);
```

---

## 4. リレーション定義

```typescript
// quiz
export const quizRelations = relations(quiz, ({ one, many }) => ({
  user: one(user, { fields: [quiz.userId], references: [user.id] }),
  questions: many(quizQuestion),
  attempts: many(quizAttempt),
}));

// quiz_question
export const quizQuestionRelations = relations(quizQuestion, ({ one, many }) => ({
  quiz: one(quiz, { fields: [quizQuestion.quizId], references: [quiz.id] }),
  choices: many(quizChoice),
  answers: many(quizAttemptAnswer),
}));

// quiz_choice
export const quizChoiceRelations = relations(quizChoice, ({ one }) => ({
  question: one(quizQuestion, { fields: [quizChoice.questionId], references: [quizQuestion.id] }),
}));

// quiz_attempt
export const quizAttemptRelations = relations(quizAttempt, ({ one, many }) => ({
  user: one(user, { fields: [quizAttempt.userId], references: [user.id] }),
  quiz: one(quiz, { fields: [quizAttempt.quizId], references: [quiz.id] }),
  answers: many(quizAttemptAnswer),
}));

// quiz_attempt_answer
export const quizAttemptAnswerRelations = relations(quizAttemptAnswer, ({ one }) => ({
  attempt: one(quizAttempt, { fields: [quizAttemptAnswer.attemptId], references: [quizAttempt.id] }),
  question: one(quizQuestion, { fields: [quizAttemptAnswer.questionId], references: [quizQuestion.id] }),
  selectedChoice: one(quizChoice, { fields: [quizAttemptAnswer.selectedChoiceId], references: [quizChoice.id] }),
}));
```

---

## 5. スキーマファイル構成

```
packages/db/src/schema/
├── auth.ts          # 既存: user, session, account, verification
├── quiz.ts          # 新規: quiz, quizQuestion, quizChoice
├── quizAttempt.ts   # 新規: quizAttempt, quizAttemptAnswer
└── index.ts         # 全スキーマを re-export
```

---

## 6. マイグレーション

Drizzle Kit を使用してマイグレーションファイルを生成します。

```bash
# マイグレーションファイル生成
bun run db:generate

# マイグレーション実行
bun run db:migrate
```

`drizzle.config.ts` は `packages/db/` に配置済みです。

---

## 7. データ量見積もり

| テーブル | 想定レコード数（1ユーザー / 月） |
|---------|-------------------------------|
| `quiz` | 〜50件 |
| `quiz_question` | 〜250件（quiz × 5問） |
| `quiz_choice` | 〜1,000件（question × 4択） |
| `quiz_attempt` | 〜100件 |
| `quiz_attempt_answer` | 〜500件 |

SQLite は小〜中規模の利用に十分対応可能です。
