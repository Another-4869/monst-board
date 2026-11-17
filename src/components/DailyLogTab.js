import React, { useState, useMemo, useRef } from 'react';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const GROUP_STYLES = [
  { short: 'Ⅰ', colorClass: 'daily-g1' },
  { short: 'Ⅱ', colorClass: 'daily-g2' },
  { short: 'Ⅲ', colorClass: 'daily-g3' },
  { short: 'Ⅳ', colorClass: 'daily-g4' },
  { short: 'Ⅴ', colorClass: 'daily-g5' },
];

// モンストの日判定（10日・20日・30日 ※2月は10日・20日・最終日）
export function isMonstDayDate(year, month, day) {
  if (day === 10 || day === 20) return true;
  if (month === 2) {
    const lastDayOfFeb = new Date(year, 2, 0).getDate();
    return day === lastDayOfFeb;
  }
  return day === 30;
}

// シートの日付セル（ISO文字列 or "11/17(火)" 等）を解析
export function parseDailyDate(val, fallbackYear = 2026) {
  if (val === null || val === undefined || val === '') return null;
  const str = val.toString().trim();

  if (str.includes('T') || /^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dowIdx = d.getDay();
      const dow = WEEKDAYS[dowIdx];
      return {
        dateObj: new Date(year, month - 1, day),
        year,
        month,
        day,
        dowIdx,
        dow,
        label: `${month}/${day}(${dow})`,
        fullLabel: `${year}/${month}/${day}(${dow})`,
        key: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      };
    }
  }

  const m = str.match(/^(\d{1,2})[/-](\d{1,2})/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    const d = new Date(fallbackYear, month - 1, day);
    const dowIdx = d.getDay();
    const dow = WEEKDAYS[dowIdx];
    return {
      dateObj: d,
      year: fallbackYear,
      month,
      day,
      dowIdx,
      dow,
      label: `${month}/${day}(${dow})`,
      fullLabel: `${fallbackYear}/${month}/${day}(${dow})`,
      key: `${fallbackYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }

  return null;
}

// 今日の日付オブジェクト（0時0分0秒）を取得
export function getTodayDateInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const dowIdx = now.getDay();
  const dow = WEEKDAYS[dowIdx];
  return {
    dateObj: new Date(year, month - 1, day),
    year,
    month,
    day,
    dowIdx,
    dow,
    label: `${month}/${day}(${dow})`,
    fullLabel: `${year}/${month}/${day}(${dow})`,
    key: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

export default function DailyLogTab({ data }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL'); // 'ALL' or 0..4
  const [onlyMonstDay, setOnlyMonstDay] = useState(false);
  const [hideEmptyDays, setHideEmptyDays] = useState(false);
  // 過去・未来方向に何週間分まで表示するか（初期値: 前後2週間）
  const [pastWeeks, setPastWeeks] = useState(2);
  const [futureWeeks, setFutureWeeks] = useState(2);

  const todayCardRef = useRef(null);
  const todayInfo = useMemo(() => getTodayDateInfo(), []);

  // ヘッダー（グループ名）と全行データを整形
  const { groupHeaders, allRows, todayRecord } = useMemo(() => {
    if (!data || data.length === 0) {
      return { groupHeaders: [], allRows: [], todayRecord: null };
    }

    const headerRow = data[0] || [];
    const headers = GROUP_STYLES.map((g, idx) => {
      const rawTitle = headerRow[idx + 1]
        ? headerRow[idx + 1].toString().trim()
        : g.short;
      return {
        index: idx,
        short: g.short,
        full: rawTitle || g.short,
        colorClass: g.colorClass,
      };
    });

    const parsedList = [];
    let foundToday = null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      const dateInfo = parseDailyDate(row[0], todayInfo.year);
      if (!dateInfo) continue;

      const entries = headers.map((h) => {
        const val =
          row[h.index + 1] !== null && row[h.index + 1] !== undefined
            ? row[h.index + 1].toString().trim()
            : '';
        return {
          ...h,
          text: val,
        };
      });

      const hasAnyContent = entries.some((e) => e.text !== '');
      const isMonstDay = isMonstDayDate(
        dateInfo.year,
        dateInfo.month,
        dateInfo.day
      );
      const isToday = dateInfo.key === todayInfo.key;

      const record = {
        rowIndex: i,
        dateInfo,
        entries,
        hasAnyContent,
        isMonstDay,
        isToday,
      };

      if (isToday) {
        foundToday = record;
      }
      parsedList.push(record);
    }

    return {
      groupHeaders: headers,
      allRows: parsedList,
      todayRecord: foundToday,
    };
  }, [data, todayInfo]);

  // 検索・モンストの日・グループ・空欄除外・期間（前後2週間〜）による絞り込み
  const { filteredRows, isSearching, hasOlderRows, hasNewerRows } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const searching = q !== '';

    const minDate = new Date(todayInfo.dateObj);
    minDate.setDate(minDate.getDate() - pastWeeks * 7);

    const maxDate = new Date(todayInfo.dateObj);
    maxDate.setDate(maxDate.getDate() + futureWeeks * 7);

    let olderExists = false;
    let newerExists = false;

    const list = allRows.filter((item) => {
      // 1. モンストの日のみ表示スイッチ
      if (onlyMonstDay && !item.isMonstDay) {
        return false;
      }

      // 2. 空欄日非表示スイッチ（今日だけは残す）
      if (hideEmptyDays && !item.hasAnyContent && !item.isToday) {
        return false;
      }

      // 3. グループ絞り込み時：そのグループに何か記載がある日だけ抽出
      if (selectedGroup !== 'ALL') {
        const targetEntry = item.entries[selectedGroup];
        if (!targetEntry || !targetEntry.text) {
          return false;
        }
      }

      // 4. 検索ワードがある場合：全期間から検索
      if (searching) {
        const dateMatch =
          item.dateInfo.label.toLowerCase().includes(q) ||
          item.dateInfo.fullLabel.toLowerCase().includes(q);
        const textMatch = item.entries.some((e) => {
          if (selectedGroup !== 'ALL' && e.index !== selectedGroup) return false;
          return e.text.toLowerCase().includes(q);
        });
        return dateMatch || textMatch;
      }

      // 5. 「モンストの日のみ表示」ON時は全期間のモンストの日を表示
      if (onlyMonstDay) {
        return true;
      }

      // 6. 通常時：今日を基準に前後2週間（＋「もっと見る」で拡張した範囲）のみ表示
      if (item.dateInfo.dateObj < minDate) {
        olderExists = true;
        return false;
      }
      if (item.dateInfo.dateObj > maxDate) {
        newerExists = true;
        return false;
      }

      return true;
    });

    return {
      filteredRows: list,
      isSearching: searching,
      hasOlderRows: olderExists,
      hasNewerRows: newerExists,
    };
  }, [
    allRows,
    searchQuery,
    selectedGroup,
    onlyMonstDay,
    hideEmptyDays,
    pastWeeks,
    futureWeeks,
    todayInfo,
  ]);

  const handleJumpToToday = () => {
    setSearchQuery('');
    setOnlyMonstDay(false);
    setPastWeeks(2);
    setFutureWeeks(2);
    setTimeout(() => {
      if (todayCardRef.current) {
        todayCardRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 80);
  };

  if (!data || data.length === 0) {
    return <div className="loading">日別記録データが見つかりません</div>;
  }

  return (
    <div className="daily-wrapper">
      {/* 1. 今日の記録ピックアップ（最上部カード） */}
      <div className="daily-today-hero">
        <div className="daily-today-header">
          <div className="daily-today-title-area">
            <span className="daily-today-badge">📌 今日の記録・予定</span>
            <h2 className="daily-today-date">{todayInfo.fullLabel}</h2>
            {isMonstDayDate(todayInfo.year, todayInfo.month, todayInfo.day) && (
              <span className="daily-monst-badge">🎉 モンストの日</span>
            )}
          </div>
          <button className="daily-jump-btn" onClick={handleJumpToToday}>
            🎯 今日の位置へ移動
          </button>
        </div>

        {todayRecord ? (
          <div className="daily-group-rows">
            {todayRecord.entries.map((entry) => (
              <div
                key={entry.index}
                className={`daily-group-row ${entry.colorClass}`}
              >
                <span className="daily-group-pill">{entry.full}</span>
                <span
                  className={`daily-group-text ${
                    !entry.text ? 'empty-text' : ''
                  }`}
                >
                  {entry.text || '（記載なし）'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="daily-empty-notice">
            本日の行（{todayInfo.label}）はまだ記載がありません
          </div>
        )}
      </div>

      {/* 2. 検索・グループ絞り込み・表示スイッチ */}
      <div className="filter-section">
        <div className="orb-search-bar-row">
          <input
            type="text"
            className="search-input"
            style={{ marginBottom: 0 }}
            placeholder="🔍 クエスト名・タスク・日付で全期間検索（例：星墓14、庭園、メンテ）"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="orb-sort-btn"
              onClick={() => setSearchQuery('')}
            >
              クリア
            </button>
          )}
        </div>

        <div className="filter-row" style={{ alignItems: 'center' }}>
          <span className="filter-label" style={{ marginTop: 0 }}>
            グループ:
          </span>
          <div className="attr-filters">
            <button
              className={`attr-btn ${selectedGroup === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedGroup('ALL')}
            >
              すべて
            </button>
            {groupHeaders.map((g) => (
              <button
                key={g.index}
                className={`attr-btn ${
                  selectedGroup === g.index ? 'active' : ''
                }`}
                onClick={() =>
                  setSelectedGroup(selectedGroup === g.index ? 'ALL' : g.index)
                }
              >
                {g.full}
              </button>
            ))}
          </div>
        </div>

        <div className="daily-options-row">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <label className="daily-checkbox-label">
              <input
                type="checkbox"
                checked={onlyMonstDay}
                onChange={(e) => setOnlyMonstDay(e.target.checked)}
              />
              <span>🎉 モンストの日のみ表示</span>
            </label>

            <label className="daily-checkbox-label">
              <input
                type="checkbox"
                checked={hideEmptyDays}
                onChange={(e) => setHideEmptyDays(e.target.checked)}
              />
              <span>🙈 記録・予定なしの空欄日を隠す</span>
            </label>
          </div>

          <span className="daily-range-info">
            {isSearching
              ? `🔍 全期間から検索中（${filteredRows.length}件ヒット）`
              : onlyMonstDay
              ? `🎉 モンストの日のみ全期間表示（${filteredRows.length}日分）`
              : `📅 表示範囲: 今日から前後${pastWeeks}週間（${filteredRows.length}日分）`}
          </span>
        </div>
      </div>

      {/* 3. 「もっと過去を見る」ボタン */}
      {!isSearching && !onlyMonstDay && hasOlderRows && (
        <div className="daily-more-bar">
          <button
            className="daily-more-btn"
            onClick={() => setPastWeeks((prev) => prev + 2)}
          >
            ⏪ もっと過去を見る（さらに2週間前まで表示）
          </button>
        </div>
      )}

      {/* 4. 日別カード一覧 */}
      <div className="daily-card-list">
        {filteredRows.length === 0 ? (
          <div className="daily-empty-notice">
            条件に一致する記録が見つかりませんでした
          </div>
        ) : (
          filteredRows.map((item) => {
            const dowClass =
              item.dateInfo.dowIdx === 0
                ? 'is-sunday'
                : item.dateInfo.dowIdx === 6
                ? 'is-saturday'
                : '';

            const visibleEntries =
              selectedGroup === 'ALL'
                ? item.entries
                : item.entries.filter((e) => e.index === selectedGroup);

            return (
              <div
                key={item.dateInfo.key}
                ref={item.isToday ? todayCardRef : null}
                className={`daily-card ${item.isToday ? 'is-today' : ''} ${
                  item.isMonstDay ? 'is-monst-day' : ''
                } ${!item.hasAnyContent ? 'is-empty-day' : ''}`}
              >
                <div className="daily-card-header">
                  <div className="daily-card-date-group">
                    <span className={`daily-card-date ${dowClass}`}>
                      {item.dateInfo.label}
                    </span>
                    <span className="daily-card-year">
                      {item.dateInfo.year}年
                    </span>
                    {item.isToday && (
                      <span className="daily-today-tag">TODAY</span>
                    )}
                    {item.isMonstDay && (
                      <span className="daily-monst-badge">🎉 モンストの日</span>
                    )}
                  </div>
                  {!item.hasAnyContent && (
                    <span className="daily-no-entry-tag">予定なし</span>
                  )}
                </div>

                {item.hasAnyContent && (
                  <div className="daily-group-rows">
                    {visibleEntries.map((entry) => (
                      <div
                        key={entry.index}
                        className={`daily-group-row ${entry.colorClass}`}
                      >
                        <span className="daily-group-pill">{entry.full}</span>
                        <span
                          className={`daily-group-text ${
                            !entry.text ? 'empty-text' : ''
                          }`}
                        >
                          {entry.text || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. 「もっと先の予定を見る」ボタン */}
      {!isSearching && !onlyMonstDay && hasNewerRows && (
        <div className="daily-more-bar" style={{ marginTop: '14px' }}>
          <button
            className="daily-more-btn"
            onClick={() => setFutureWeeks((prev) => prev + 2)}
          >
            ⏩ もっと先の予定を見る（さらに2週間先まで表示）
          </button>
        </div>
      )}
    </div>
  );
}