import React from 'react';

// 🌟 今後バージョンアップする時は、この配列の一番上に1ブロック追加するだけで
// ホーム画面の「Ver表記」と「最終更新日」も自動で最新に切り替わります！
export const CHANGELOG_DATA = [
  {
    version: 'Ver.1.1.0',
    date: '2026/11/17',
    summary: '「日別記録」ページを追加＆ホーム画面に今日の予定を表示',
    details: [
      '「日別記録」タブを新設（今日の記録ピックアップ・モンストの日判定＆絞り込み・グループ別色分けに対応）',
      '最初は今日から前後2週間分を表示し、「もっと過去を見る」ボタンや全期間検索で過去履歴を閲覧可能に',
      'ホーム画面に今日のやることを一覧表示するセクションを追加',
    ],
  },
  {
    version: 'Ver.1.0.0',
    date: '2026/11/15',
    summary: '管理ボードを公開',
    details: [
      'ホーム画面（メインメニュー）および左スライドメニュー（☰）を実装',
      'ToDo・キャラ・厳選・編成・オーブの全5シート連携機能を公開',
    ],
  },
];

export default function ChangelogTab() {
  return (
    <div className="changelog-wrapper">
      <div className="changelog-header-box">
        <h2 className="changelog-page-title">🕒 変更履歴</h2>
        <p className="changelog-page-sub">
          モンスト管理ボードのアップデート・機能追加の履歴です。
        </p>
      </div>

      <div className="changelog-list">
        {CHANGELOG_DATA.map((item, idx) => (
          <div
            key={item.version}
            className={`changelog-card ${idx === 0 ? 'latest' : ''}`}
          >
            <div className="changelog-card-top">
              <div className="changelog-ver-group">
                <span className="changelog-ver-badge">{item.version}</span>
                {idx === 0 && <span className="changelog-latest-tag">LATEST</span>}
              </div>
              <span className="changelog-date">{item.date}</span>
            </div>

            <div className="changelog-summary">{item.summary}</div>

            {item.details && item.details.length > 0 && (
              <ul className="changelog-details">
                {item.details.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}