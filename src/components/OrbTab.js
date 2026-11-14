import React, { useState, useMemo } from 'react';

export default function OrbTab({ data }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);
  const [isTwoCol, setIsTwoCol] = useState(false); // 🌟 1列 / 2列の表示切り替え
  const [visibleCount, setVisibleCount] = useState(50); // 🌟 縦に伸びすぎないよう初期50件表示

  if (!data || data.length < 6) {
    return (
      <div className="generic-table-wrapper">
        オーブ推移データがありません。
      </div>
    );
  }

  // 🌟 ご指定のグループ順（1,2,3,4, 5,7,9, 6,8,01, 02,04,06, 03,05,07, 0）
  const ACCOUNT_ORDER = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '7',
    '9',
    '6',
    '8',
    '01',
    '02',
    '04',
    '06',
    '03',
    '05',
    '07',
    '0',
  ];
  const GROUP_TARGETS = ['共通', 'メイン,サブ', 'メイン', 'サブ'];

  const toggleTarget = (targetName) => {
    setSelectedTargets((prev) =>
      prev.includes(targetName)
        ? prev.filter((t) => t !== targetName)
        : [...prev, targetName]
    );
  };

  const formatDate = (val) => {
    if (!val) return '';
    const str = val.toString().trim();
    if (str.includes('T')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}/${(d.getMonth() + 1)
          .toString()
          .padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
      }
    }
    return str;
  };

  const getAccountGroupClass = (accName) => {
    if (['1', '2', '3', '4'].includes(accName)) return 'orb-group-yellow';
    if (['5', '7', '9'].includes(accName)) return 'orb-group-orange';
    if (['6', '8', '01'].includes(accName)) return 'orb-group-blue';
    if (['02', '04', '06'].includes(accName)) return 'orb-group-green';
    if (['03', '05', '07'].includes(accName)) return 'orb-group-pink';
    if (accName === '0') return 'orb-group-zero';
    return '';
  };

  // 1. G1:L6からオーブ数を読み取り、指定の順番に整列
  const { accountList, totalOrbs } = useMemo(() => {
    const pairs = [
      { nameRow: 0, valRow: 1 },
      { nameRow: 2, valRow: 3 },
      { nameRow: 4, valRow: 5 },
    ];

    const countMap = {};
    let total = 0;

    pairs.forEach(({ nameRow, valRow }) => {
      for (let col = 6; col <= 11; col++) {
        const rawName = data[nameRow]?.[col];
        const rawVal = data[valRow]?.[col];
        const name =
          rawName !== null && rawName !== undefined
            ? rawName.toString().trim()
            : '';
        const count =
          rawVal !== null && rawVal !== undefined && rawVal !== ''
            ? Number(rawVal)
            : null;

        if (name !== '' && count !== null && !isNaN(count)) {
          countMap[name] = count;
          total += count;
        }
      }
    });

    const list = ACCOUNT_ORDER.map((acc) => ({
      name: acc,
      count: countMap[acc] !== undefined ? countMap[acc] : 0,
    }));

    return { accountList: list, totalOrbs: total };
  }, [data]);

  // 2. 7行目以降から履歴データを抽出
  const historyLogs = useMemo(() => {
    const logs = [];
    for (let i = 6; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      const date = formatDate(row[0]);
      const target =
        row[1] !== null && row[1] !== undefined ? row[1].toString().trim() : '';
      const diffRaw = row[2];
      const balanceRaw = row[3];
      const category = row[4] ? row[4].toString().trim() : '';
      const note = row[5] ? row[5].toString().trim() : '';

      if (!date && !target && (diffRaw === '' || diffRaw === null) && !category)
        continue;

      const diff =
        diffRaw !== null && diffRaw !== undefined && diffRaw !== ''
          ? Number(diffRaw)
          : 0;
      const balance =
        balanceRaw !== null && balanceRaw !== undefined && balanceRaw !== ''
          ? Number(balanceRaw)
          : null;

      logs.push({
        id: i,
        date,
        target,
        diff,
        balance,
        category,
        note,
      });
    }
    return newestFirst ? logs.reverse() : logs;
  }, [data, newestFirst]);

  const categories = useMemo(() => {
    const set = new Set(historyLogs.map((l) => l.category).filter(Boolean));
    return ['すべて', ...Array.from(set)];
  }, [historyLogs]);

  // 3. フィルタリング
  const filteredLogs = historyLogs.filter((log) => {
    if (selectedTargets.length > 0) {
      const rawTarget = log.target;
      let isMatch = false;

      if (rawTarget === 'メイン,サブ') {
        isMatch = selectedTargets.includes('メイン,サブ');
      } else {
        const tokens = rawTarget.split(',').map((s) => s.trim());
        isMatch = selectedTargets.some((sel) => tokens.includes(sel));
      }

      if (!isMatch) return false;
    }

    if (selectedCategory !== 'すべて' && log.category !== selectedCategory) {
      return false;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchCat = log.category.toLowerCase().includes(term);
      const matchNote = log.note.toLowerCase().includes(term);
      const matchDate = log.date.toLowerCase().includes(term);
      const matchTarget = log.target.toLowerCase().includes(term);
      if (!matchCat && !matchNote && !matchDate && !matchTarget) return false;
    }

    return true;
  });

  return (
    <div className="orb-wrapper">
      {/* 上部：アカウント別オーブ所持数 */}
      <div className="orb-summary-section">
        <div className="orb-summary-header">
          <div className="orb-title-area">
            <h2 className="orb-section-title">💎 アカウント別所持オーブ</h2>
            <span className="orb-hint">
              ※タップで下の履歴を絞り込み（複数選択可）
            </span>
          </div>
          <div className="orb-totals">
            <div className="orb-total-badge">
              全合計: <strong>{totalOrbs.toLocaleString()}</strong> 個
            </div>
          </div>
        </div>

        <div className="orb-account-strip">
          {accountList.map((item) => {
            const isSelected = selectedTargets.includes(item.name);
            const groupClass = getAccountGroupClass(item.name);
            return (
              <button
                key={item.name}
                className={`orb-acc-card ${groupClass} ${
                  isSelected ? 'selected' : ''
                }`}
                onClick={() => toggleTarget(item.name)}
              >
                <div className="orb-acc-name">{item.name}</div>
                <div className="orb-acc-count">
                  {item.count.toLocaleString()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 中部：検索＆フィルター */}
      <div
        className="filter-section"
        style={{ marginBottom: '16px', padding: '12px' }}
      >
        <div className="orb-search-bar-row">
          <input
            type="text"
            className="search-input"
            style={{ marginBottom: 0 }}
            placeholder="備考・カテゴリ・日付で検索（例: 書庫、トレイル、2026/11）..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className="orb-sort-btn"
            onClick={() => setIsTwoCol(!isTwoCol)}
            title="表示列数の切り替え"
          >
            {isTwoCol ? '📋 1列表示' : '🗂️ 2列表示'}
          </button>
          <button
            className="orb-sort-btn"
            onClick={() => setNewestFirst(!newestFirst)}
          >
            {newestFirst ? '⬇ 最新順' : '⬆ 古い順'}
          </button>
        </div>

        <div
          className="filter-row"
          style={{ alignItems: 'center', marginTop: '10px' }}
        >
          <span
            className="filter-label"
            style={{ width: 'auto', marginTop: 0 }}
          >
            対象:
          </span>
          <div className="attr-filters" style={{ alignItems: 'center' }}>
            <button
              className={`attr-btn ${
                selectedTargets.length === 0 ? 'active' : ''
              }`}
              onClick={() => setSelectedTargets([])}
            >
              すべて
            </button>

            {GROUP_TARGETS.map((t) => (
              <button
                key={t}
                className={`attr-btn ${
                  selectedTargets.includes(t) ? 'active' : ''
                }`}
                onClick={() => toggleTarget(t)}
              >
                {t}
              </button>
            ))}

            <span style={{ color: '#444', margin: '0 2px' }}>|</span>

            {ACCOUNT_ORDER.map((acc) => (
              <button
                key={acc}
                className={`orb-target-num-btn ${
                  selectedTargets.includes(acc) ? 'active' : ''
                }`}
                onClick={() => toggleTarget(acc)}
              >
                {acc}
              </button>
            ))}
          </div>
        </div>

        <div
          className="filter-row"
          style={{
            alignItems: 'center',
            marginTop: '10px',
            position: 'relative',
          }}
        >
          <span
            className="filter-label"
            style={{ width: 'auto', marginTop: 0 }}
          >
            カテゴリ:
          </span>
          <div className="orb-cat-dropdown-wrap">
            <button
              className="orb-cat-dropdown-btn"
              onClick={() => setIsCatOpen(!isCatOpen)}
            >
              {selectedCategory === 'すべて'
                ? 'すべてのカテゴリ'
                : selectedCategory}{' '}
              ▼
            </button>

            {isCatOpen && (
              <div className="orb-cat-dropdown-menu">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className={`orb-cat-option ${
                      selectedCategory === cat ? 'selected' : ''
                    }`}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsCatOpen(false);
                    }}
                  >
                    {cat}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedCategory !== 'すべて' && (
            <button
              className="orb-clear-btn"
              onClick={() => setSelectedCategory('すべて')}
            >
              クリア
            </button>
          )}
        </div>
      </div>

      {/* 🌟 下部：引き締まったテーブル形式の履歴リスト */}
      <div
        className={`orb-table-container ${isTwoCol ? 'two-col' : 'one-col'}`}
      >
        {filteredLogs.slice(0, visibleCount).map((log) => {
          const isPlus = log.diff > 0;
          const isMinus = log.diff < 0;
          return (
            <div key={log.id} className="orb-table-row">
              <span className="orb-col-date">{log.date}</span>
              <span className="orb-col-target" title={log.target}>
                {log.target}
              </span>
              <span
                className={`orb-col-diff ${
                  isPlus ? 'plus' : isMinus ? 'minus' : 'zero'
                }`}
              >
                {isPlus ? `+${log.diff}` : log.diff}
              </span>
              <span className="orb-col-balance">
                {log.balance !== null
                  ? `残 ${log.balance.toLocaleString()}`
                  : ''}
              </span>
              <span className="orb-col-content">
                {log.category && (
                  <span className="orb-log-category">{log.category}</span>
                )}
                {log.note && <span className="orb-log-note">{log.note}</span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* 続きを表示するボタン */}
      {filteredLogs.length > visibleCount && (
        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <button
            className="orb-load-more-btn"
            onClick={() => setVisibleCount((prev) => prev + 100)}
          >
            さらに100件表示（残り {filteredLogs.length - visibleCount} 件）
          </button>
        </div>
      )}
    </div>
  );
}
