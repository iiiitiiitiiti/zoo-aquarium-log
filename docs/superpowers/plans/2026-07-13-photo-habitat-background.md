# 生息地の二面窓・写真背景 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** PC表示の左右を、ローカル保存したキリンとクラゲの写真による固定背景へ置き換える。

**Architecture:** .site-stage::before と .site-stage::after を左右の固定写真レイヤーとして使い、中央480pxのReactコンテンツから分離する。Unsplash写真は720×1280pxのWebPとしてリポジトリへ保存し、CSSはローカルアセットだけを参照する。720px以下では写真レイヤーを非表示にし、深緑の下地だけを残す。

**Tech Stack:** React 19、Vite 7、CSS、Vitest 3、Unsplash WebP assets、Chrome DevTools

## Global Constraints

- 幅480px内のログイン画面、施設一覧、施設詳細、フォーム、文言、機能は変更しない。
- 左側はキリン、右側はクラゲの写真を各1枚だけ使用する。
- 写真はローカルWebPとして保存し、各300KB以下にする。
- 写真はスクロール位置に対して固定し、常時アニメーション、パララックス、スライドショーを追加しない。
- 721px以上で写真を表示し、720px以下では写真を非表示にする。
- 生成り方眼、線画SVG、分類ラベルは撤去する。
- 横スクロールを発生させない。

---

## File Structure

- src/assets/zoo-habitat.webp: 左側に表示する720×1280pxのキリン写真。
- src/assets/aquarium-habitat.webp: 右側に表示する720×1280pxのクラゲ写真。
- src/assets/photo-credits.md: 撮影者、Unsplash元ページ、用途を記録する。
- src/photoAssets.test.ts: WebP形式、容量上限、クレジット記録を検証する。
- src/styles.css: 固定写真レイヤー、オーバーレイ、フォールバック色、720px境界を定義する。
- src/styles.test.ts: 写真背景のCSS契約と旧線画撤去を検証する。
- src/assets/zoo-field-guide.svg: 削除する。
- src/assets/aquarium-field-guide.svg: 削除する。

---

### Task 1: 写真アセットと出典記録

**Files:**
- Create: src/photoAssets.test.ts
- Create: src/assets/zoo-habitat.webp
- Create: src/assets/aquarium-habitat.webp
- Create: src/assets/photo-credits.md

**Interfaces:**
- Consumes: Unsplash image CDNのキリン写真 photo-1616128417769-89bbabd3aa85 とクラゲ写真 photo-1650120529615-7274f18da535。
- Produces: CSSから url("./assets/zoo-habitat.webp") と url("./assets/aquarium-habitat.webp") で参照できるWebPファイル。

- [ ] **Step 1: WebPとクレジットを検証する失敗テストを書く**

src/photoAssets.test.ts を作成する。

~~~ts
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const photos = [
  {
    path: "src/assets/zoo-habitat.webp",
    credit: "CHUTTERSNAP",
    source: "https://unsplash.com/photos/yjOp7klp6ag",
  },
  {
    path: "src/assets/aquarium-habitat.webp",
    credit: "Matthieu Rochette",
    source: "https://unsplash.com/photos/7zWL4_KHG1s",
  },
];

describe("habitat background photos", () => {
  it.each(photos)(
    "$path is a local WebP no larger than 300KB",
    ({ path }) => {
      const bytes = readFileSync(path);

      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
      expect(statSync(path).size).toBeLessThanOrEqual(300_000);
    },
  );

  it("records the photographer and source URL for each photo", () => {
    const credits = readFileSync("src/assets/photo-credits.md", "utf8");

    for (const { credit, source } of photos) {
      expect(credits).toContain(credit);
      expect(credits).toContain(source);
    }
  });
});
~~~

- [ ] **Step 2: テストがアセット未作成で失敗することを確認する**

Run:

~~~powershell
npm test -- --run src/photoAssets.test.ts
~~~

Expected: ENOENT で src/assets/zoo-habitat.webp が存在しないためFAIL。

- [ ] **Step 3: 720×1280pxのWebPをローカルへ取得する**

PowerShellで次を個別に実行する。

~~~powershell
Invoke-WebRequest -Uri 'https://images.unsplash.com/photo-1616128417769-89bbabd3aa85?fm=webp&fit=crop&w=720&h=1280&crop=faces&q=75' -OutFile 'src/assets/zoo-habitat.webp'
~~~

~~~powershell
Invoke-WebRequest -Uri 'https://images.unsplash.com/photo-1650120529615-7274f18da535?fm=webp&fit=crop&w=720&h=1280&crop=entropy&q=75' -OutFile 'src/assets/aquarium-habitat.webp'
~~~

Expected: 両ファイルが作成され、各300,000 bytes以下。

- [ ] **Step 4: 写真クレジットを記録する**

src/assets/photo-credits.md を作成する。

~~~markdown
# Background photo credits

- Zoo habitat: Photo by CHUTTERSNAP on Unsplash
  - Source: https://unsplash.com/photos/yjOp7klp6ag
  - Local asset: zoo-habitat.webp
- Aquarium habitat: Photo by Matthieu Rochette on Unsplash
  - Source: https://unsplash.com/photos/7zWL4_KHG1s
  - Local asset: aquarium-habitat.webp

Both photos are used under the Unsplash License:
https://unsplash.com/license
~~~

- [ ] **Step 5: アセットテストが通ることを確認する**

Run:

~~~powershell
npm test -- --run src/photoAssets.test.ts
~~~

Expected: 3 tests PASS（it.each 2件 + クレジット1件）。

- [ ] **Step 6: 写真アセットをコミットする**

~~~powershell
git add src/photoAssets.test.ts src/assets/zoo-habitat.webp src/assets/aquarium-habitat.webp src/assets/photo-credits.md
git commit -m "assets: 背景用の生息地写真を追加"
~~~

---

### Task 2: 固定写真背景へCSSを差し替える

**Files:**
- Modify: src/styles.test.ts
- Modify: src/styles.css:2
- Modify: src/styles.css:6
- Delete: src/assets/zoo-field-guide.svg
- Delete: src/assets/aquarium-field-guide.svg

**Interfaces:**
- Consumes: Task 1の zoo-habitat.webp と aquarium-habitat.webp。
- Produces: .site-stage::before を左写真、.site-stage::after を右写真として固定表示するCSS契約。

- [ ] **Step 1: 写真背景の失敗テストへ書き換える**

src/styles.test.ts を次の内容へ置き換える。

~~~ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

describe("responsive styles", () => {
  it("uses the approved local habitat photos", () => {
    expect(styles).toContain('url("./assets/zoo-habitat.webp")');
    expect(styles).toContain('url("./assets/aquarium-habitat.webp")');
    expect(styles).toContain("background-color:#102e28");
  });

  it("removes the field-guide artwork and labels", () => {
    expect(styles).not.toContain("field-guide.svg");
    expect(styles).not.toContain("#ece6d7");
    expect(styles).not.toContain("background-size:22px 22px");
    expect(styles).not.toContain('content:"ZOOLOGY / FIELD 01"');
    expect(styles).not.toContain('content:"AQUATIC LIFE / FIELD 02"');
  });

  it("keeps both habitat photos fixed while content scrolls", () => {
    expect(styles).toMatch(
      /\.site-stage:before,\.site-stage:after\{[^}]*position:fixed/,
    );
  });

  it("uses a high-contrast focus indicator for logout", () => {
    expect(styles).toMatch(
      /\.session-button:focus-visible\{[^}]*outline-color:#f7f4e8/,
    );
  });

  it("hides habitat photos at 720px and below", () => {
    expect(styles).toContain(
      "@media(max-width:720px){.site-stage:before,.site-stage:after{display:none}}",
    );
  });
});
~~~

- [ ] **Step 2: CSSテストが旧線画参照のため失敗することを確認する**

Run:

~~~powershell
npm test -- --run src/styles.test.ts
~~~

Expected: 写真URLがなく、field-guide.svg と #ece6d7 が残っているためFAIL。

- [ ] **Step 3: .site-stage の背景定義を写真レイヤーへ置き換える**

src/styles.css 2行目を次へ置き換える。

~~~css
.site-stage{position:relative;min-height:100dvh;isolation:isolate;overflow:clip;background-color:#102e28}.site-stage:before,.site-stage:after{content:"";position:fixed;z-index:-1;top:0;bottom:0;width:calc((100vw - 480px)/2);box-sizing:border-box;pointer-events:none;background-repeat:no-repeat;background-size:cover}.site-stage:before{left:0;background-color:#334a34;background-image:linear-gradient(90deg,#102e2814 0,#102e2838 62%,#102e28d9 100%),url("./assets/zoo-habitat.webp");background-position:center 38%}.site-stage:after{right:0;background-color:#073d59;background-image:linear-gradient(270deg,#102e2814 0,#102e2838 62%,#102e28d9 100%),url("./assets/aquarium-habitat.webp");background-position:center}
~~~

- [ ] **Step 4: 写真の非表示境界を720pxへ変更する**

src/styles.css の既存メディアクエリを置き換える。

~~~css
@media(max-width:720px){.site-stage:before,.site-stage:after{display:none}}
~~~

- [ ] **Step 5: 旧線画SVGを削除する**

~~~powershell
git rm src/assets/zoo-field-guide.svg src/assets/aquarium-field-guide.svg
~~~

- [ ] **Step 6: CSS回帰テストが通ることを確認する**

Run:

~~~powershell
npm test -- --run src/styles.test.ts
~~~

Expected: 5 tests PASS。

- [ ] **Step 7: 写真背景の実装をコミットする**

~~~powershell
git add src/styles.css src/styles.test.ts
git commit -m "style: PC背景を生息地写真へ変更"
~~~

---

### Task 3: ブラウザ検証・全体検証・公開

**Files:**
- Verify: src/styles.css
- Verify: src/assets/zoo-habitat.webp
- Verify: src/assets/aquarium-habitat.webp

**Interfaces:**
- Consumes: Task 2までの写真背景。
- Produces: PC・境界幅・スマホ・本番GitHub Pagesで検証済みの公開状態。

- [ ] **Step 1: 全自動検証を実行する**

Run each command:

~~~powershell
npm test -- --run
npm run lint
npm run build
npm run test:data
git diff --check
~~~

Expected:

- Vitest: 既存26件 + 写真アセット3件 = 29 tests PASS
- TypeScript lint: exit 0
- Vite production build: exit 0
- 施設データ: 7 tests PASS
- git diff --check: 出力なし

- [ ] **Step 2: ローカル表示を1200×844pxで確認する**

Run:

~~~powershell
npm run dev -- --host 127.0.0.1 --port 4173
~~~

Chrome DevToolsで http://127.0.0.1:4173/zoo-aquarium-log/ を開き、次を確認する。

- 中央コンテンツ幅は480px
- 左にキリン、右にクラゲが表示される
- 写真の中央側が暗く、コンテンツとの境界が明瞭
- document.documentElement.scrollWidth === 1200
- Networkに2点のWebPの200応答があり、Unsplashへの画像リクエストがない

- [ ] **Step 3: 固定背景と境界幅を確認する**

DevToolsで .site-stage に一時的に min-height:2200px を設定し、900pxスクロールする。

Expected:

- 両疑似要素の position が fixed
- スクロール前後でキリンとクラゲの画面上の位置が変わらない

Viewportを721px、720px、481px、480px、390pxへ順に変更する。

Expected:

- 721px: 左右写真が表示される
- 720px以下: 両疑似要素が display:none
- 全幅: document.documentElement.scrollWidth === innerWidth
- 390px: 既存スマホ画面の見た目が変更されていない

- [ ] **Step 4: deployスキルでmainへ公開する**

実装ブランチをpushし、mainをfast-forwardしてpushする。git push --force は使用しない。

Expected:

- featureブランチ、ローカルmain、origin/main が同一SHA
- GitHub Actions Deploy GitHub Pages が completed / success

- [ ] **Step 5: GitHub Pages本番を再検証する**

現在の公開SHAを取得し、その値でキャッシュを回避したURLを開く。

~~~powershell
$sha = git rev-parse --short HEAD
$url = "https://iiiitiiitiiti.github.io/zoo-aquarium-log/?v=$sha"
$url
~~~

Expected:

- 1200pxで左右写真が表示される
- 720px以下で写真が表示されない
- WebPがGitHub Pagesから200で配信される
- 横スクロールとコンソールエラーがない

- [ ] **Step 6: Daily Worklogを更新する**

NotionのDaily Worklogページ 3971a1f2781e80fe8afcf3745c41cf02 をfetchし、2026-07-13の既存zoo-aquarium-log背景更新行を次へ置き換える。

~~~text
Windows / zoo-aquarium-log: PC背景をキリンとクラゲの写真による「生息地の二面窓」へ刷新。写真をローカルWebP化し、固定表示・720px以下の非表示・横スクロールなしを実機検証してGitHub Pagesへ再デプロイ
~~~

更新後に再fetchし、同じ文言が1件だけ存在することを確認する。
