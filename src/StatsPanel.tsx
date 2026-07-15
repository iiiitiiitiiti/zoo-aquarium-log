import type { StatsModel, StatsCount } from "./stats";
import "./stats.css";
import type { FacilityType } from "./types";

const typeLabels: Record<FacilityType, string> = {
  zoo: "動物園",
  aquarium: "水族館",
  both: "動物園・水族館",
  other: "その他",
};

function progressPercent({ visited, total }: StatsCount) {
  return total === 0 ? 0 : Math.min(100, Math.floor((visited / total) * 100));
}

function formatMonth(value: string) {
  const [year, month] = value.split("-");
  return `${year}年${Number(month)}月`;
}

function ProgressRow({ label, visited, total }: { label: string; visited: number; total: number }) {
  const percent = progressPercent({ visited, total });
  return (
    <li className="stats-progress-row">
      <div className="stats-row-heading">
        <span>{label}</span>
        <strong>{visited} / {total} 館</strong>
      </div>
      <div className="stats-bar-track" aria-hidden="true">
        <div className="stats-bar-fill" style={{ width: `${percent}%` }} />
      </div>
    </li>
  );
}

export default function StatsPanel({ stats, onBack }: { stats: StatsModel; onBack: () => void }) {
  const monthlyMax = Math.max(1, ...stats.monthly.map((row) => row.count));

  return (
    <main className="app-shell stats-shell">
      <header className="stats-hero">
        <button className="back-button" type="button" onClick={onBack}>← 施設一覧</button>
        <p className="eyebrow">FIELD STATISTICS</p>
        <h1>記録の統計</h1>
        <p className="stats-note">※閉園済みの館は母数から除外しています。</p>
      </header>

      <nav className="stats-anchor-nav stats-anchor-nav--three-columns" aria-label="統計の項目">
        <a className="stats-anchor-link" href="#stats-type">
          <span>種別別</span>
          <span className="stats-anchor-arrow" aria-hidden="true" />
        </a>
        <a className="stats-anchor-link" href="#stats-pref">
          <span>都道府県別</span>
          <span className="stats-anchor-arrow" aria-hidden="true" />
        </a>
        <a className="stats-anchor-link" href="#stats-monthly">
          <span>訪問数の推移</span>
          <span className="stats-anchor-arrow" aria-hidden="true" />
        </a>
      </nav>

      <section className="stats-section stats-summary" aria-labelledby="stats-summary-heading">
        <p className="stats-kicker">OVERALL COMPLETION</p>
        <h2 id="stats-summary-heading">全体制覇率</h2>
        <p className="stats-percent">{stats.overall.percent}<span>%</span></p>
        <p className="stats-count">{stats.overall.visited} / {stats.overall.total} 館</p>
      </section>

      <section id="stats-type" className="stats-section" aria-labelledby="stats-type-heading">
        <div className="stats-section-heading">
          <p className="stats-kicker">FACILITY TYPE</p>
          <h2 id="stats-type-heading">種別別</h2>
        </div>
        {stats.byType.length === 0 ? (
          <p className="stats-empty">対象施設がありません。</p>
        ) : (
          <ul className="stats-progress-list">
            {stats.byType.map((row) => (
              <ProgressRow key={row.type} label={typeLabels[row.type]} visited={row.visited} total={row.total} />
            ))}
          </ul>
        )}
      </section>

      <section id="stats-pref" className="stats-section" aria-labelledby="stats-pref-heading">
        <div className="stats-section-heading">
          <p className="stats-kicker">PREFECTURE</p>
          <h2 id="stats-pref-heading">都道府県別</h2>
        </div>
        {stats.byPref.length === 0 ? (
          <p className="stats-empty">対象施設がありません。</p>
        ) : (
          <ul className="stats-progress-list">
            {stats.byPref.map((row) => (
              <ProgressRow key={row.pref} label={row.pref} visited={row.visited} total={row.total} />
            ))}
          </ul>
        )}
      </section>

      <section id="stats-monthly" className="stats-section stats-monthly-section" aria-labelledby="stats-monthly-heading">
        <div className="stats-section-heading">
          <p className="stats-kicker">VISIT RECORDS</p>
          <h2 id="stats-monthly-heading">訪問数の推移</h2>
        </div>
        {stats.monthly.length === 0 ? (
          <p className="stats-empty">訪問記録がまだありません。</p>
        ) : (
          <>
            <div className="stats-monthly-scroll">
              <ul className="stats-monthly-list">
                {stats.monthly.map((row) => (
                  <li key={row.month} className="stats-monthly-item">
                    <strong>訪問記録 {row.count}件</strong>
                    <div className="stats-monthly-bar-track" aria-hidden="true">
                      <div
                        className="stats-monthly-bar-fill"
                        style={{ height: `${Math.floor((row.count / monthlyMax) * 100)}%` }}
                      />
                    </div>
                    <span>{formatMonth(row.month)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="stats-scroll-hint">横にスクロールできます</p>
          </>
        )}
      </section>

      <footer><p>統計は保存済みの訪問記録から計算しています。</p></footer>
    </main>
  );
}
