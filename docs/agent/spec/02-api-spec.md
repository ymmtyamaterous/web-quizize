# Web Quizize — API 設計書

> 作成日: 2026-03-30  
> バージョン: 1.0.0  
> 通信方式: oRPC（JSON-RPC over HTTP）  
> ベースパス: `/api`

---

## 1. 概要

本プロジェクトは **oRPC** を使用して API を定義します。クライアント・サーバー間で TypeScript の型を完全共有し、型安全な通信を実現します。

### 認証方式

- `publicProcedure`: 認証不要（ヘルスチェック等）
- `protectedProcedure`: better-auth のセッションクッキー必須（認証済みユーザーのみ）

---

## 2. ルーター構成

```typescript
appRouter
├── healthCheck              // publicProcedure
├── auth.*                   // better-auth 内部（別エンドポイント /api/auth/**）
├── quiz
│   ├── generate             // protectedProcedure
│   ├── list                 // protectedProcedure
│   ├── get                  // protectedProcedure
│   └── delete               // protectedProcedure
├── quizAttempt
│   ├── start                // protectedProcedure
│   ├── answer               // protectedProcedure
│   └── complete             // protectedProcedure
└── stats
    ├── summary              // protectedProcedure
    └── history              // protectedProcedure
```

---

## 3. エンドポイント詳細

### 3.1 ヘルスチェック

#### `healthCheck`

| 項目 | 内容 |
|------|------|
| 認証 | 不要（publicProcedure） |
| 説明 | サーバーの稼働確認 |

**レスポンス**

```typescript
"OK"
```

---

### 3.2 クイズ管理 (`quiz.*`)

#### `quiz.generate`

| 項目 | 内容 |
|------|------|
| 認証 | 必要（protectedProcedure） |
| 説明 | URL からコンテンツを取得し、AI でクイズを生成する |

**入力**

```typescript
{
  url: string;          // 対象 WebページのURL（https:// 必須）
  difficulty: "easy" | "medium" | "hard";  // 難易度（デフォルト: "medium"）
  questionCount?: number;  // 生成問題数（デフォルト: 5、最大: 10）
}
```

**レスポンス**

```typescript
{
  quizId: string;       // 生成されたクイズのID
  status: "ready";      // 生成ステータス
  title: string;        // ページタイトル（取得元）
  questionCount: number;
}
```

**エラーケース**

| エラーコード | 説明 |
|-------------|------|
| `INVALID_URL` | 不正なURL形式またはアクセス不可のURL |
| `FETCH_FAILED` | ページコンテンツの取得失敗 |
| `AI_ERROR` | AI APIの呼び出し失敗 |
| `CONTENT_TOO_SHORT` | ページのテキストコンテンツが短すぎる（500文字未満） |

---

#### `quiz.list`

| 項目 | 内容 |
|------|------|
| 認証 | 必要（protectedProcedure） |
| 説明 | ログイン中ユーザーが生成したクイズ一覧を取得する |

**入力**

```typescript
{
  page?: number;    // ページ番号（デフォルト: 1）
  limit?: number;   // 1ページあたりの件数（デフォルト: 20、最大: 50）
}
```

**レスポンス**

```typescript
{
  quizzes: Array<{
    id: string;
    sourceUrl: string;
    sourceTitle: string;
    difficulty: "easy" | "medium" | "hard";
    questionCount: number;
    createdAt: string;  // ISO 8601
    lastAttemptAt: string | null;
    bestScore: number | null;   // 最高正答数
    attemptCount: number;       // 挑戦回数
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

---

#### `quiz.get`

| 項目 | 内容 |
|------|------|
| 認証 | 必要（protectedProcedure） |
| 説明 | クイズ詳細（問題・選択肢）を取得する |

**入力**

```typescript
{
  quizId: string;
}
```

**レスポンス**

```typescript
{
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  difficulty: "easy" | "medium" | "hard";
  createdAt: string;
  questions: Array<{
    id: string;
    type: "fill_blank" | "multiple_choice";
    sentence: string;   // 穴埋め: "___" を含む文、4択: 問題文
    orderIndex: number;
    choices: Array<{
      id: string;
      text: string;
      orderIndex: number;
      // isCorrect はクライアントに送らない（回答後のみ返す）
    }>;
  }>;
}
```

**エラーケース**

| エラーコード | 説明 |
|-------------|------|
| `NOT_FOUND` | 指定IDのクイズが存在しない |
| `FORBIDDEN` | 他ユーザーのクイズへのアクセス |

---

#### `quiz.delete`

| 項目 | 内容 |
|------|------|
| 認証 | 必要（protectedProcedure） |
| 説明 | クイズを削除する（関連するAttempt・Answerも CASCADE 削除） |

**入力**

```typescript
{
  quizId: string;
}
```

**レスポンス**

```typescript
{
  success: true;
}
```

---

### 3.3 クイズ挑戦管理 (`quizAttempt.*`)

#### `quizAttempt.start`

| 項目 | 内容 |
|------|------|
| 認証 | 必要（protectedProcedure） |
| 説明 | クイズ挑戦セッションを開始する |

**入力**

```typescript
{
  quizId: string;
}
```

**レスポンス**

```typescript
{
  attemptId: string;
  startedAt: string;  // ISO 8601
}
```

---

#### `quizAttempt.answer`

| 項目 | 内容 |
|------|------|
| 認証 | 必要（protectedProcedure） |
| 説明 | 1問分の回答を送信し、正誤と解説を受け取る |

**入力**

```typescript
{
  attemptId: string;
  questionId: string;
  selectedChoiceId: string;  // 4択の場合
  // 将来的な穴埋め入力用: inputAnswer?: string;
}
```

**レスポンス**

```typescript
{
  isCorrect: boolean;
  correctChoiceId: string;   // 正解の選択肢ID
  explanation: string;       // 解説テキスト
  correctAnswer: string;     // 正解テキスト（表示用）
}
```

---

#### `quizAttempt.complete`

| 項目 | 内容 |
|------|------|
| 認証 | 必要（protectedProcedure） |
| 説明 | クイズ挑戦を完了し、最終スコアを取得する |

**入力**

```typescript
{
  attemptId: string;
}
```

**レスポンス**

```typescript
{
  score: number;          // 正答数
  totalQuestions: number;
  accuracy: number;       // 正答率（0〜100）
  timeTakenSeconds: number;
  answers: Array<{
    questionId: string;
    sentence: string;
    selectedChoiceId: string;
    isCorrect: boolean;
    correctAnswer: string;
    explanation: string;
  }>;
}
```

---

### 3.4 学習統計 (`stats.*`)

#### `stats.summary`

| 項目 | 内容 |
|------|------|
| 認証 | 必要（protectedProcedure） |
| 説明 | ユーザーの学習サマリーを取得する |

**入力**

```typescript
// 入力なし（ログイン中ユーザーのデータを返す）
{}
```

**レスポンス**

```typescript
{
  totalQuizzesGenerated: number;  // 生成したクイズ数
  totalAttempts: number;          // 挑戦回数
  totalQuestionsAnswered: number; // 回答した問題数
  overallAccuracy: number;        // 総合正答率（0〜100）
  totalStudyTimeSeconds: number;  // 累計学習時間（秒）
  currentStreak: number;          // 連続学習日数
}
```

---

#### `stats.history`

| 項目 | 内容 |
|------|------|
| 認証 | 必要（protectedProcedure） |
| 説明 | 学習履歴（Attempt 一覧）を取得する |

**入力**

```typescript
{
  page?: number;   // ページ番号（デフォルト: 1）
  limit?: number;  // 件数（デフォルト: 20）
}
```

**レスポンス**

```typescript
{
  history: Array<{
    attemptId: string;
    quizId: string;
    sourceTitle: string;
    sourceUrl: string;
    score: number;
    totalQuestions: number;
    accuracy: number;
    timeTakenSeconds: number;
    completedAt: string;  // ISO 8601
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

---

## 4. AI プロンプト設計

### 4.1 クイズ生成プロンプト（システム）

```
あなたは教育用クイズ生成AIです。
与えられたWebページのテキストコンテンツを元に、内容理解を助ける穴埋めクイズ（4択形式）を生成してください。

ルール:
1. 文脈上重要なキーワードや概念を空欄にする
2. 正解は必ず本文中から抽出すること
3. 不正解の選択肢は本文と関連があるが明らかに誤りのものにする
4. 解説は本文の内容をもとに簡潔に記述する
5. 難易度に応じてキーワードの重要度・専門性を調整する

出力形式（JSON）:
{
  "questions": [
    {
      "sentence": "___を含む問題文（___が空欄）",
      "answer": "正解の語句",
      "explanation": "解説文",
      "choices": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"]
      // choices[0] が必ず正解
    }
  ]
}
```

### 4.2 難易度別指示

| 難易度 | 指示内容 |
|--------|----------|
| `easy` | 見出しレベルの重要語句、固有名詞、数値など明確なキーワードを対象にする |
| `medium` | 文脈理解が必要な概念語・動詞・因果関係を対象にする |
| `hard` | 複数の情報を組み合わせた推論が必要なキーワードや、専門的な表現を対象にする |

---

## 5. 外部サービス連携

### 5.1 さくらの AI Engine

| 項目 | 内容 |
|------|------|
| ベース URL | `process.env.SAKURA_AI_API_BASE_URL` |
| 認証 | Bearer トークン（`SAKURA_AI_API_KEY`） |
| 互換性 | OpenAI Chat Completions API 互換 |
| モデル | `process.env.SAKURA_AI_MODEL` |
| リクエスト形式 | `POST /v1/chat/completions` |
| レスポンス形式 | JSON Mode（`response_format: { type: "json_object" }`） |

### 5.2 URL コンテンツ取得

| 項目 | 内容 |
|------|------|
| 手法 | サーバーサイドで `fetch()` を使用 |
| HTML パース | Cheerio（`$('p, h1, h2, h3, h4, li').text()` 等でテキスト抽出） |
| SSRF 対策 | プライベート IP（10.x.x.x, 192.168.x.x, 127.x.x.x）へのアクセスを拒否 |
| タイムアウト | 10 秒 |
| 最大コンテンツ長 | 50,000 文字（超過分は先頭から切り捨て） |
