import React, { useState, useMemo, useEffect } from 'react';
import { parseDailyDate } from './DailyLogTab';

// カテゴリ定義（表示順＆色）
const CATEGORIES = [
  { key: 'クエスト', label: 'クエスト', colorClass: 'cat-quest' },
  { key: 'コラボ', label: 'コラボ', colorClass: 'cat-collab' },
  { key: 'ガチャ', label: 'ガチャ', colorClass: 'cat-gacha' },
  { key: 'キャンペーン', label: 'キャンペーン', colorClass: 'cat-campaign' },
  { key: 'その他', label: 'その他', colorClass: 'cat-other' },
];

// 属性カラー定義（書庫5色など）
const ATTR_COLOR_MAP = {
  火: 'attr-fire',
  水: 'attr-water',
  木: 'attr-wood',
  光: 'attr-light',
  闇: 'attr-dark',
};

// グループ表示ラベル（日別記録用）
const GROUP_LABELS = [
  { key: 'Ⅰ', label: 'Ⅰ (1, 2, 3, 4)', color: '#eab308' },
  { key: 'Ⅱ', label: 'Ⅱ (5, 7, 02, 04)', color: '#f97316' },
  { key: 'Ⅲ', label: 'Ⅲ (6, 9, 03, 06)', color: '#3b82f6' },
  { key: 'Ⅳ', label: 'Ⅳ (8, 01, 05, 07)', color: '#22c55e' },
  { key: 'Ⅴ', label: 'Ⅴ (0)', color: '#ec4899' },
];

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// 1行目の見出し名から列インデックスを自動判別（列順を入れ替えても壊れない）
function resolveEventColMap(headerRow) {
  const headers = (headerRow || []).map((v) => String(v || '').trim());
  const findIdx = (regex, fallback) => {
    const idx = headers.findIndex((h) => regex.test(h));
    return idx !== -1 ? idx : fallback;
  };
  return {
    category: findIdx(/^カテゴリ$/, 0),
    title: findIdx(/^イベント名$/, 1),
    start: findIdx(/^開始日時$/, 2),
    end: findIdx(/^終了日時$/, 3),
    url: findIdx(/^情報元URL$/, 4),
    fetched: findIdx(/^最終取得日時$/, 5),
    groupName: findIdx(/^親グループ名$/, 6),
    attrColor: findIdx(/^属性カラー$/, 7),
    todoCheck: findIdx(/^ToDo化$/, 8),
    todoNo: findIdx(/^連携ToDo/, 9),
  };
}

// 検索用の文字列正規化（大文字小文字・全角半角の揺れを吸収）
function normalizeSearchText(str) {
  return String(str || '')
    .normalize('NFKC')
    .toLowerCase();
}

// 日時文字列・Date・ISO文字列を安全にDateへ変換
function parseSheetDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const str = String(val).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  const m = str.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{2}))?/
  );
  if (m) {
    const d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      m[4] ? Number(m[4]) : 0,
      m[5] ? Number(m[5]) : 0,
      0
    );
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTime(d) {
  if (!d) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d, days) {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
}

function getMonday(d) {
  const base = startOfDay(d);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(base, diff);
}

function diffDays(targetDate, baseDate) {
  const a = startOfDay(targetDate).getTime();
  const b = startOfDay(baseDate).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

// 半日スロット（1日＝午前0:00-11:59、午後12:00-23:59 の2マス）の位置計算
function calcHalfDayRange(evStart, evEnd, rangeStartDate, totalDays) {
  const totalSlots = totalDays * 2;
  const startDiff = diffDays(evStart, rangeStartDate);
  const startHalf = evStart.getHours() >= 12 ? 1 : 0;
  const rawStartSlot = startDiff * 2 + startHalf;

  const endDiff = diffDays(evEnd, rangeStartDate);
  const endH = evEnd.getHours();
  const endM = evEnd.getMinutes();

  let rawEndSlotExclusive;
  if (endH === 0 && endM === 0) {
    rawEndSlotExclusive = endDiff * 2;
  } else if (endH < 12 || (endH === 12 && endM === 0)) {
    rawEndSlotExclusive = endDiff * 2 + 1;
  } else {
    rawEndSlotExclusive = endDiff * 2 + 2;
  }

  if (rawEndSlotExclusive <= rawStartSlot) {
    rawEndSlotExclusive = rawStartSlot + 1;
  }

  const clampedStart = Math.max(0, Math.min(totalSlots, rawStartSlot));
  const clampedEnd = Math.max(0, Math.min(totalSlots, rawEndSlotExclusive));

  if (clampedEnd <= clampedStart) return null;

  return {
    leftPct: (clampedStart / totalSlots) * 100,
    widthPct: ((clampedEnd - clampedStart) / totalSlots) * 100,
    continuesBefore: rawStartSlot < 0,
    continuesAfter: rawEndSlotExclusive > totalSlots,
  };
}

export default function ScheduleTab({ allData, data }) {
  const sheets = allData || data || {};

  // PCは週表示、スマホ幅（768px未満）は自動で日表示スタート
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  );
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [enabledCats, setEnabledCats] = useState({
    クエスト: true,
    コラボ: true,
    ガチャ: true,
    キャンペーン: true,
    その他: true,
  });
  const [showTodoBadges, setShowTodoBadges] = useState(true);
  const [hideDoneEvents, setHideDoneEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTodoDay, setSelectedTodoDay] = useState(null);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedEvent(null);
        setSelectedTodoDay(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const isSearching = searchQuery.trim().length > 0;

  // 表示する日付配列を計算
  const visibleDays = useMemo(() => {
    if (viewMode === 'day') {
      return [startOfDay(anchorDate)];
    }
    if (viewMode === 'week') {
      const mon = getMonday(anchorDate);
      return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
    }
    const y = anchorDate.getFullYear();
    const m = anchorDate.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => new Date(y, m, i + 1));
  }, [viewMode, anchorDate]);

  const rangeStart = visibleDays[0];
  const rangeEnd = useMemo(() => {
    const last = visibleDays[visibleDays.length - 1];
    return new Date(
      last.getFullYear(),
      last.getMonth(),
      last.getDate(),
      23,
      59,
      59,
      999
    );
  }, [visibleDays]);

  // 0. 「ToDo」シートを全件読み込み（日付別マップ＋No.別マップを同時構築）
  const { todosByDate, todosByNo } = useMemo(() => {
    const rows = sheets['ToDo'] || [];
    if (rows.length < 3) return { todosByDate: {}, todosByNo: {} };

    const byDate = {};
    const byNo = {};

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const noStr =
        row[0] !== null && row[0] !== undefined ? String(row[0]).trim() : '';
      const title = row[8] ? String(row[8]).trim() : '';
      if (!title && !noStr) continue;

      const status = row[9] ? String(row[9]).trim() : '未着手';
      const doneDate = row[3];
      const isDone =
        status === '完了' ||
        (doneDate !== '' && doneDate !== null && doneDate !== undefined);

      const rawDue = row[2];
      const deadline =
        rawDue && String(rawDue).trim() !== '無期限'
          ? parseSheetDate(rawDue)
          : null;

      const todoObj = {
        id: `todo-${i}`,
        no: noStr,
        title,
        deadline,
        category: row[7] ? String(row[7]).trim() : '',
        target:
          row[6] !== null && row[6] !== undefined ? String(row[6]).trim() : '',
        status,
        isDone,
      };

      if (noStr) {
        byNo[noStr] = todoObj;
      }

      if (!isDone && title && deadline) {
        const dKey = toDateKey(deadline);
        if (!byDate[dKey]) byDate[dKey] = [];
        byDate[dKey].push(todoObj);
      }
    }

    return { todosByDate: byDate, todosByNo: byNo };
  }, [sheets]);

  // 1. 「イベント予定」シートから公式イベントを読み込み（見出し名で列位置を自動解決）
  const { officialEvents, lastFetchedText } = useMemo(() => {
    const rows = sheets['イベント予定'] || [];
    if (rows.length < 2) return { officialEvents: [], lastFetchedText: '' };

    const colMap = resolveEventColMap(rows[0]);
    const list = [];
    let latestFetched = '';

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[colMap.title]) continue;
      const category = String(row[colMap.category] || 'その他').trim();
      const title = String(row[colMap.title] || '').trim();
      const start = parseSheetDate(row[colMap.start]);
      const end = parseSheetDate(row[colMap.end]);
      const url = String(row[colMap.url] || '').trim();
      const fetched = parseSheetDate(row[colMap.fetched]);
      const groupName = String(row[colMap.groupName] || '').trim();
      const attrColor = String(row[colMap.attrColor] || '').trim();
      const rawCheck = row[colMap.todoCheck];
      const todoChecked =
        rawCheck === true || String(rawCheck || '').trim().toUpperCase() === 'TRUE';
      const rawLinkedNo = row[colMap.todoNo];
      const linkedNoRaw =
        rawLinkedNo !== null && rawLinkedNo !== undefined
          ? String(rawLinkedNo).trim()
          : '';

      if (!start || !end) continue;

      if (fetched) {
        const fStr = formatDateTime(fetched);
        if (!latestFetched || fStr > latestFetched) latestFetched = fStr;
      }

      const linkedNos = linkedNoRaw
        ? linkedNoRaw
            .split(/[,、\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const linkedTodos = linkedNos.map((n) => todosByNo[n]).filter(Boolean);

      let todoState = 'none';
      let todoStatusLabel = '';

      if (linkedTodos.length > 0) {
        if (linkedTodos.every((t) => t.isDone)) {
          todoState = 'done';
          todoStatusLabel = '完了';
        } else {
          todoState = 'active';
          todoStatusLabel = linkedTodos.some((t) => t.status === '対応中')
            ? '対応中'
            : 'ToDo';
        }
      } else if (todoChecked) {
        todoState = 'pending';
        todoStatusLabel = 'ToDo';
      }

      list.push({
        id: `official-${i}`,
        category: CATEGORIES.some((c) => c.key === category) ? category : 'その他',
        title,
        start,
        end,
        url,
        groupName,
        attrColor,
        sourceLabel: '公式発表',
        isPeriodic: false,
        todoChecked,
        linkedTodos,
        todoState,
        todoStatusLabel,
      });
    }
    return { officialEvents: list, lastFetchedText: latestFetched };
  }, [sheets, todosByNo]);

  // 2. 「予定」シートから定期イベを生成し、公式イベントと重複するサイクルは除外
  const periodicEvents = useMemo(() => {
    const rows = sheets['予定'] || [];
    const templates = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const name = String(row[1] || '').trim();
      const startDayNum = Number(row[7]);
      const endDayNum = Number(row[8]);
      if (
        !name ||
        !startDayNum ||
        !endDayNum ||
        isNaN(startDayNum) ||
        isNaN(endDayNum)
      ) {
        continue;
      }
      templates.push({ name, startDayNum, endDayNum });
    }

    if (templates.length === 0) return [];

    const startMonthCursor = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth() - 1,
      1
    );
    const endMonthCursor = new Date(
      rangeEnd.getFullYear(),
      rangeEnd.getMonth() + 1,
      1
    );

    const monthPairs = [];
    let cur = new Date(startMonthCursor);
    while (cur <= endMonthCursor) {
      monthPairs.push({ y: cur.getFullYear(), m: cur.getMonth() });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }

    const generated = [];

    templates.forEach((tpl, tIdx) => {
      const isTenma = tpl.name.includes('天魔');

      monthPairs.forEach(({ y, m }) => {
        const lastDayOfStart = new Date(y, m + 1, 0).getDate();
        let start;
        let end;

        if (isTenma) {
          start = new Date(y, m, 1, 0, 0, 0);
          end = new Date(y, m, lastDayOfStart, 23, 59, 0);
        } else {
          const sDay = Math.min(tpl.startDayNum, lastDayOfStart);
          start = new Date(y, m, sDay, 12, 0, 0);

          if (tpl.endDayNum >= tpl.startDayNum) {
            const eDay = Math.min(tpl.endDayNum, lastDayOfStart);
            end = new Date(y, m, eDay, 11, 59, 0);
          } else {
            const ny = m === 11 ? y + 1 : y;
            const nm = m === 11 ? 0 : m + 1;
            const lastDayOfEnd = new Date(ny, nm + 1, 0).getDate();
            const eDay = Math.min(tpl.endDayNum, lastDayOfEnd);
            end = new Date(ny, nm, eDay, 11, 59, 0);
          }
        }

        if (end < rangeStart || start > rangeEnd) return;

        const isDuplicatedWithOfficial = officialEvents.some((off) => {
          const overlaps = off.start <= end && off.end >= start;
          if (!overlaps) return false;
          if (tpl.name.includes('深淵')) {
            return off.title.includes('深淵');
          }
          return off.title.includes(tpl.name);
        });

        if (isDuplicatedWithOfficial) return;

        generated.push({
          id: `periodic-${tIdx}-${y}-${m}`,
          category: 'クエスト',
          title: tpl.name,
          start,
          end,
          url: '',
          groupName: '',
          attrColor: '',
          sourceLabel: '定期イベント（予定シート）',
          isPeriodic: true,
          todoChecked: false,
          linkedTodos: [],
          todoState: 'none',
          todoStatusLabel: '',
        });
      });
    });

    return generated;
  }, [sheets, rangeStart, rangeEnd, officialEvents]);

  // 3. 表示期間内の全イベントを統合＆カテゴリごとにグループ行を構築
  const { groupedByCategory, totalVisibleCount, hiddenDoneCount } = useMemo(() => {
    const merged = [...officialEvents, ...periodicEvents].filter((ev) => {
      if (!enabledCats[ev.category]) return false;
      return ev.end >= rangeStart && ev.start <= rangeEnd;
    });

    merged.sort(
      (a, b) =>
        a.end - b.end || a.start - b.start || a.title.localeCompare(b.title)
    );

    const result = {};
    let rowTotal = 0;
    let hiddenDone = 0;

    CATEGORIES.forEach(({ key }) => {
      const catEvents = merged.filter((e) => e.category === key);
      const rowsMap = new Map();

      catEvents.forEach((ev) => {
        const rowKey = ev.groupName ? `group::${ev.groupName}` : `single::${ev.id}`;
        if (!rowsMap.has(rowKey)) {
          rowsMap.set(rowKey, {
            rowKey,
            label: ev.groupName || ev.title,
            subLabel: ev.sourceLabel,
            isGroup: Boolean(ev.groupName),
            items: [],
            minStart: ev.start.getTime(),
            maxEnd: ev.end.getTime(),
          });
        }
        const entry = rowsMap.get(rowKey);
        entry.items.push(ev);
        if (ev.start.getTime() < entry.minStart) {
          entry.minStart = ev.start.getTime();
        }
        if (ev.end.getTime() > entry.maxEnd) {
          entry.maxEnd = ev.end.getTime();
        }
      });

      let rowsArr = Array.from(rowsMap.values()).map((row) => {
        const allDone =
          row.items.length > 0 && row.items.every((it) => it.todoState === 'done');
        const anyActive = row.items.some((it) => it.todoState === 'active');
        const anyPending = row.items.some((it) => it.todoState === 'pending');

        let todoState = 'none';
        let todoStatusLabel = '';
        if (allDone) {
          todoState = 'done';
          todoStatusLabel = '完了';
        } else if (anyActive) {
          todoState = 'active';
          todoStatusLabel = row.items.some((it) => it.todoStatusLabel === '対応中')
            ? '対応中'
            : 'ToDo';
        } else if (anyPending) {
          todoState = 'pending';
          todoStatusLabel = 'ToDo';
        }

        return { ...row, todoState, todoStatusLabel };
      });

      if (hideDoneEvents) {
        const beforeLen = rowsArr.length;
        rowsArr = rowsArr.filter((r) => r.todoState !== 'done');
        hiddenDone += beforeLen - rowsArr.length;
      }

      // 並び順：未完了が上・完了済みがカテゴリ最下部 → 終了日時が早い順 → 開始日時が早い順 → タイトル順
      rowsArr.sort((a, b) => {
        const aDone = a.todoState === 'done' ? 1 : 0;
        const bDone = b.todoState === 'done' ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return (
          a.maxEnd - b.maxEnd ||
          a.minStart - b.minStart ||
          a.label.localeCompare(b.label)
        );
      });

      result[key] = rowsArr;
      rowTotal += rowsArr.length;
    });

    return {
      groupedByCategory: result,
      totalVisibleCount: rowTotal,
      hiddenDoneCount: hiddenDone,
    };
  }, [officialEvents, periodicEvents, enabledCats, hideDoneEvents, rangeStart, rangeEnd]);

  // 3.5 全期間キーワード検索
  const searchResults = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];

    const tokens = normalizeSearchText(trimmed)
      .split(/\s+/)
      .filter(Boolean);

    return officialEvents
      .filter((ev) => {
        if (!enabledCats[ev.category]) return false;
        if (hideDoneEvents && ev.todoState === 'done') return false;
        const haystack = normalizeSearchText(
          `${ev.title} ${ev.groupName} ${ev.category} ${ev.attrColor}`
        );
        return tokens.every((tk) => haystack.includes(tk));
      })
      .sort(
        (a, b) =>
          b.start - a.start || b.end - a.end || a.title.localeCompare(b.title)
      );
  }, [searchQuery, officialEvents, enabledCats, hideDoneEvents]);

  // 4. 「日別記録」シートから日表示用の Ⅰ〜Ⅴ データを取得
  const dailyLogForAnchor = useMemo(() => {
    if (viewMode !== 'day') return null;
    const rows = sheets['日別記録'] || [];
    const headerRow = rows[0] || [];
    const targetYear = anchorDate.getFullYear();
    const targetKey = `${targetYear}-${String(anchorDate.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(anchorDate.getDate()).padStart(2, '0')}`;

    const labels = GROUP_LABELS.map((g, idx) => ({
      ...g,
      label: headerRow[idx + 1] ? String(headerRow[idx + 1]).trim() : g.label,
    }));

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const parsed = parseDailyDate(row[0], targetYear);
      if (parsed && parsed.key === targetKey) {
        return labels.map((g, idx) => ({
          ...g,
          text:
            row[idx + 1] !== null && row[idx + 1] !== undefined
              ? String(row[idx + 1]).trim()
              : '',
        }));
      }
    }
    return labels.map((g) => ({ ...g, text: '' }));
  }, [sheets, viewMode, anchorDate]);

  // ナビゲーション操作
  const moveRange = (delta) => {
    if (viewMode === 'day') {
      setAnchorDate((prev) => addDays(prev, delta));
    } else if (viewMode === 'week') {
      setAnchorDate((prev) => addDays(prev, delta * 7));
    } else {
      setAnchorDate(
        (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
      );
    }
  };

  const moveByOneDay = (delta) => {
    setAnchorDate((prev) => addDays(prev, delta));
  };

  const goToday = () => {
    setSearchQuery('');
    setAnchorDate(startOfDay(new Date()));
  };

  const jumpToEventWeek = (ev) => {
    setAnchorDate(startOfDay(ev.start));
    setViewMode('week');
    setSearchQuery('');
  };

  const toggleCategory = (key) => {
    setEnabledCats((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const periodHeading = useMemo(() => {
    const first = visibleDays[0];
    const last = visibleDays[visibleDays.length - 1];
    if (viewMode === 'day') {
      return `${first.getFullYear()}年${first.getMonth() + 1}月${first.getDate()}日（${
        WEEKDAYS[first.getDay()]
      }）`;
    }
    if (viewMode === 'month') {
      return `${first.getFullYear()}年${first.getMonth() + 1}月`;
    }
    return `${first.getMonth() + 1}月${first.getDate()}日〜${
      last.getMonth() + 1
    }月${last.getDate()}日`;
  }, [viewMode, visibleDays]);

  const getBarColorClass = (ev) => {
    if (ev.todoState === 'done') {
      return 'cat-done';
    }
    if (ev.attrColor && ATTR_COLOR_MAP[ev.attrColor]) {
      return ATTR_COLOR_MAP[ev.attrColor];
    }
    const found = CATEGORIES.find((c) => c.key === ev.category);
    return found ? found.colorClass : 'cat-other';
  };

  const getCategoryColorOnly = (category) => {
    const found = CATEGORIES.find((c) => c.key === category);
    return found ? found.colorClass : 'cat-other';
  };

  const getEventStatusInfo = (ev) => {
    const nowTime = Date.now();
    if (ev.end.getTime() < nowTime) {
      return { label: '終了', className: 'is-ended' };
    }
    if (ev.start.getTime() > nowTime) {
      return { label: '開催予定', className: 'is-upcoming' };
    }
    return { label: '開催中', className: 'is-active' };
  };

  const renderTodoLinkBadge = (todoState, todoStatusLabel) => {
    if (todoState === 'done') {
      return (
        <span className="sch-todo-link-badge is-done" title="紐づくToDoは完了済み">
          ✅ 完了
        </span>
      );
    }
    if (todoState === 'active' || todoState === 'pending') {
      return (
        <span
          className="sch-todo-link-badge is-active"
          title="ToDoシートに登録済み"
        >
          📋 {todoStatusLabel || 'ToDo'}
        </span>
      );
    }
    return null;
  };

  const dayTodos = todosByDate[toDateKey(anchorDate)] || [];

  return (
    <div className="schedule-container">
      {/* ヘッダー */}
      <div className="schedule-header">
        <div>
          <h2 className="schedule-title">🗓️ イベント予定</h2>
          <p className="schedule-subtitle">
            公式発表・定期イベ（予定シート）・ToDo進捗をまとめて確認（0〜12時 / 12〜24時分割）
          </p>
        </div>
        {lastFetchedText && (
          <div className="schedule-sync-badge">
            公式取得：{lastFetchedText}
          </div>
        )}
      </div>

      {/* コントロールバー */}
      <div className="schedule-controls">
        <div className="schedule-nav-group">
          <button className="sch-btn" onClick={() => moveRange(-1)}>
            ‹ {viewMode === 'month' ? '前月' : viewMode === 'week' ? '前週' : '前日'}
          </button>
          <button className="sch-btn sch-btn-today" onClick={goToday}>
            今日を表示
          </button>
          <button className="sch-btn" onClick={() => moveRange(1)}>
            {viewMode === 'month' ? '次月' : viewMode === 'week' ? '次週' : '翌日'} ›
          </button>
          {viewMode === 'week' && (
            <>
              <button className="sch-btn sch-btn-sub" onClick={() => moveByOneDay(-1)}>
                ‹ 前日
              </button>
              <button className="sch-btn sch-btn-sub" onClick={() => moveByOneDay(1)}>
                次日 ›
              </button>
            </>
          )}
        </div>

        <div className="schedule-period-label">
          {isSearching ? `🔍 全期間検索` : periodHeading}
        </div>

        <div className="schedule-view-switch">
          <button
            className={`sch-mode-btn ${!isSearching && viewMode === 'day' ? 'active' : ''}`}
            onClick={() => {
              setSearchQuery('');
              setViewMode('day');
            }}
          >
            日表示
          </button>
          <button
            className={`sch-mode-btn ${!isSearching && viewMode === 'week' ? 'active' : ''}`}
            onClick={() => {
              setSearchQuery('');
              setViewMode('week');
            }}
          >
            週表示
          </button>
          <button
            className={`sch-mode-btn ${!isSearching && viewMode === 'month' ? 'active' : ''}`}
            onClick={() => {
              setSearchQuery('');
              setViewMode('month');
            }}
          >
            月表示
          </button>
        </div>
      </div>

      {/* カテゴリフィルター＆全期間キーワード検索 */}
      <div className="schedule-filter-bar">
        <div className="schedule-filters">
          {CATEGORIES.map((cat) => (
            <label key={cat.key} className="sch-filter-chip">
              <input
                type="checkbox"
                checked={enabledCats[cat.key]}
                onChange={() => toggleCategory(cat.key)}
              />
              <span className={`sch-dot ${cat.colorClass}`} />
              <span>{cat.label}</span>
            </label>
          ))}
          <label className="sch-filter-chip">
            <input
              type="checkbox"
              checked={showTodoBadges}
              onChange={() => setShowTodoBadges((v) => !v)}
            />
            <span>📋 ToDo期限</span>
          </label>
          <label className="sch-filter-chip sch-filter-hide-done">
            <input
              type="checkbox"
              checked={hideDoneEvents}
              onChange={() => setHideDoneEvents((v) => !v)}
            />
            <span>✅ 完了を隠す</span>
          </label>
        </div>

        <div className="schedule-filter-right">
          <div className="sch-search-box">
            <span className="sch-search-icon">🔍</span>
            <input
              type="text"
              className="sch-search-input"
              placeholder="全期間検索（例: STARLIGHT、書庫）"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="sch-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="検索をクリア"
              >
                ✕
              </button>
            )}
          </div>
          <div className="schedule-count-label">
            {isSearching
              ? `${searchResults.length}件ヒット`
              : hiddenDoneCount > 0
              ? `${totalVisibleCount}件表示（完了${hiddenDoneCount}件非表示）`
              : `${totalVisibleCount}件表示`}
          </div>
        </div>
      </div>

      {/* ========== 全期間検索結果ビュー ========== */}
      {isSearching ? (
        <div className="schedule-search-view">
          <div className="sch-search-header">
            <div className="sch-search-summary">
              <strong>「{searchQuery.trim()}」</strong>の全期間検索結果：
              <strong>{searchResults.length}件</strong>（新しい開催順）
            </div>
            <button
              type="button"
              className="sch-search-reset-btn"
              onClick={() => setSearchQuery('')}
            >
              ✕ カレンダーに戻る
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="sch-search-empty">
              該当するイベントが見つかりませんでした（上のフィルター設定もご確認ください）。
            </div>
          ) : (
            <div className="sch-search-list">
              {searchResults.map((ev) => {
                const status = getEventStatusInfo(ev);
                return (
                  <div
                    key={ev.id}
                    className={`sch-search-card ${
                      ev.todoState === 'done' ? 'is-done' : ''
                    }`}
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <div className="sch-search-card-main">
                      <div className="sch-search-badges">
                        <span
                          className={`sch-modal-badge ${getCategoryColorOnly(
                            ev.category
                          )}`}
                        >
                          {ev.category}
                        </span>
                        {ev.attrColor && (
                          <span
                            className={`sch-modal-badge ${ATTR_COLOR_MAP[ev.attrColor]}`}
                          >
                            {ev.attrColor}属性
                          </span>
                        )}
                        <span className={`sch-status-badge ${status.className}`}>
                          {status.label}
                        </span>
                        {renderTodoLinkBadge(ev.todoState, ev.todoStatusLabel)}
                      </div>
                      <div className="sch-search-title">
                        {ev.groupName ? `${ev.groupName}：${ev.title}` : ev.title}
                      </div>
                      <div className="sch-search-time">
                        {formatDateTime(ev.start)} 〜 {formatDateTime(ev.end)}
                      </div>
                    </div>

                    <div className="sch-search-card-actions">
                      <button
                        type="button"
                        className="sch-jump-week-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          jumpToEventWeek(ev);
                        }}
                      >
                        📅 開催週へ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : viewMode === 'day' ? (
        /* ========== 日表示モード（スマホ最適＋日別記録 Ⅰ〜Ⅴ 表示） ========== */
        <div className="schedule-day-view">
          <div className="sch-day-card sch-daily-log-card">
            <div className="sch-day-card-header">
              <span>
                📝 日別記録（{anchorDate.getMonth() + 1}/{anchorDate.getDate()}）
              </span>
            </div>
            <div className="sch-daily-log-list">
              {(dailyLogForAnchor || []).map((g) => (
                <div
                  key={g.key}
                  className="sch-daily-log-row"
                  style={{ borderLeftColor: g.color }}
                >
                  <span className="sch-daily-group-tag">{g.label}</span>
                  <span className={`sch-daily-log-text ${!g.text ? 'empty' : ''}`}>
                    {g.text || '（記載なし）'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {showTodoBadges && dayTodos.length > 0 && (
            <div className="sch-day-card sch-day-todo-card">
              <div className="sch-day-card-header">
                <span>📋 この日が期限のToDo（{dayTodos.length}件）</span>
              </div>
              <div className="sch-day-todo-list">
                {dayTodos.map((t) => (
                  <div key={t.id} className="sch-day-todo-item">
                    <div className="sch-day-todo-title">📋 {t.title}</div>
                    <div className="sch-day-todo-meta">
                      {t.category && <span className="sch-meta-pill">{t.category}</span>}
                      {t.target && <span className="sch-meta-pill">対象: {t.target}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {CATEGORIES.filter((c) => enabledCats[c.key]).map((cat) => {
            const rows = groupedByCategory[cat.key] || [];
            const flatEvents = rows.flatMap((r) => r.items);
            if (cat.key === 'コラボ' && flatEvents.length === 0) return null;

            return (
              <div key={cat.key} className="sch-day-section">
                <div className={`sch-cat-banner ${cat.colorClass}`}>
                  <span>{cat.label}</span>
                  <span className="sch-cat-count">{flatEvents.length}件</span>
                </div>
                {flatEvents.length === 0 ? (
                  <div className="sch-empty-row">この日の開催予定はありません</div>
                ) : (
                  <div className="sch-day-event-list">
                    {flatEvents.map((ev) => (
                      <button
                        key={ev.id}
                        className={`sch-day-event-card ${getBarColorClass(ev)}`}
                        onClick={() => setSelectedEvent(ev)}
                      >
                        <div className="sch-day-ev-top">
                          <span className="sch-day-ev-title">
                            {ev.todoState === 'done' ? '✅ ' : ''}
                            {ev.groupName ? `${ev.groupName}：${ev.title}` : ev.title}
                          </span>
                          <div className="sch-day-ev-right-meta">
                            {renderTodoLinkBadge(ev.todoState, ev.todoStatusLabel)}
                            <span className="sch-day-ev-source">{ev.sourceLabel}</span>
                          </div>
                        </div>
                        <div className="sch-day-ev-time">
                          {formatDateTime(ev.start)} 〜 {formatDateTime(ev.end)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ========== 週表示・月表示（半日分割ガントチャート） ========== */
        <div className="schedule-gantt-wrapper">
          <div
            className={`schedule-gantt-inner ${
              viewMode === 'month' ? 'is-month' : 'is-week'
            }`}
            style={{
              minWidth:
                viewMode === 'month' ? `${220 + visibleDays.length * 46}px` : '780px',
            }}
          >
            {/* 日付ヘッダー行（縦スクロール時に上部固定） */}
            <div className="sch-gantt-header-row">
              <div className="sch-label-col sch-header-corner">
                <span className="sch-corner-year">{rangeStart.getFullYear()}年</span>
                <span className="sch-corner-month">{rangeStart.getMonth() + 1}月</span>
              </div>
              <div
                className="sch-timeline-grid"
                style={{ gridTemplateColumns: `repeat(${visibleDays.length}, 1fr)` }}
              >
                {visibleDays.map((d) => {
                  const key = toDateKey(d);
                  const isToday = key === todayKey;
                  const dow = d.getDay();
                  const todos = showTodoBadges ? todosByDate[key] || [] : [];
                  return (
                    <div
                      key={key}
                      className={`sch-day-col-head ${isToday ? 'is-today' : ''} ${
                        dow === 0 ? 'is-sun' : dow === 6 ? 'is-sat' : ''
                      }`}
                    >
                      <button
                        className="sch-day-head-btn"
                        title="この日の日表示を開く"
                        onClick={() => {
                          setAnchorDate(startOfDay(d));
                          setViewMode('day');
                        }}
                      >
                        <span className="sch-day-num">{d.getDate()}</span>
                        <span className="sch-day-dow">{WEEKDAYS[dow]}</span>
                      </button>
                      {todos.length > 0 && (
                        <button
                          className="sch-todo-pin-btn"
                          title={`期限ToDo ${todos.length}件（クリックで詳細）`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTodoDay({ date: d, todos });
                          }}
                        >
                          📋{todos.length > 1 ? todos.length : ''}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* カテゴリ別ブロック（コラボ非開催時は非表示） */}
            {CATEGORIES.filter((c) => enabledCats[c.key]).map((cat) => {
              const rows = groupedByCategory[cat.key] || [];
              if (cat.key === 'コラボ' && rows.length === 0) return null;

              return (
                <div key={cat.key} className="sch-gantt-category">
                  <div className={`sch-cat-banner ${cat.colorClass}`}>
                    <span>{cat.label}</span>
                  </div>

                  {rows.length === 0 ? (
                    <div className="sch-empty-row">この期間に確認済みの予定はありません</div>
                  ) : (
                    rows.map((row) => (
                      <div
                        key={row.rowKey}
                        className={`sch-gantt-row ${
                          row.todoState === 'done' ? 'is-done-row' : ''
                        }`}
                      >
                        {/* 左固定：イベント名＋ToDo連携バッジ */}
                        <div
                          className="sch-label-col sch-row-label"
                          onClick={() => {
                            if (row.items.length === 1) setSelectedEvent(row.items[0]);
                          }}
                        >
                          <div className="sch-row-title" title={row.label}>
                            {row.label}
                          </div>
                          <div className="sch-row-sub-line">
                            <span className="sch-row-sub">{row.subLabel}</span>
                            {renderTodoLinkBadge(row.todoState, row.todoStatusLabel)}
                          </div>
                        </div>

                        {/* 右側：タイムライン＋バー描画 */}
                        <div className="sch-timeline-area">
                          <div
                            className="sch-timeline-bg"
                            style={{
                              gridTemplateColumns: `repeat(${visibleDays.length}, 1fr)`,
                            }}
                          >
                            {visibleDays.map((d) => {
                              const key = toDateKey(d);
                              const isToday = key === todayKey;
                              return (
                                <div
                                  key={key}
                                  className={`sch-bg-cell ${isToday ? 'is-today' : ''}`}
                                >
                                  <div className="sch-half-am" />
                                  <div className="sch-half-pm" />
                                </div>
                              );
                            })}
                          </div>

                          <div className="sch-bars-layer">
                            {row.items.map((ev) => {
                              const pos = calcHalfDayRange(
                                ev.start,
                                ev.end,
                                rangeStart,
                                visibleDays.length
                              );
                              if (!pos) return null;

                              return (
                                <button
                                  key={ev.id}
                                  type="button"
                                  className={`sch-event-bar ${getBarColorClass(ev)} ${
                                    pos.continuesBefore ? 'cont-left' : ''
                                  } ${pos.continuesAfter ? 'cont-right' : ''}`}
                                  style={{
                                    left: `${pos.leftPct}%`,
                                    width: `${pos.widthPct}%`,
                                  }}
                                  title={`${ev.title}\n${formatDateTime(ev.start)} 〜 ${formatDateTime(
                                    ev.end
                                  )}`}
                                  onClick={() => setSelectedEvent(ev)}
                                >
                                  <span className="sch-bar-text">
                                    {ev.todoState === 'done' ? `✅ ${ev.title}` : ev.title}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* フッター注記 */}
      <div className="schedule-footer-note">
        <span>青＝クエスト / 黄＝コラボ / 橙＝ガチャ / 緑＝キャンペーン / 紫＝その他 / 灰＝ToDo完了済（書庫は属性5色）。</span>
        <span>日付クリックで「日表示」、バー・📋クリックで詳細を確認できます。</span>
      </div>

      {/* イベント詳細モーダル */}
      {selectedEvent && (
        <div className="sch-modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="sch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sch-modal-header">
              <h3 className="sch-modal-title">
                {selectedEvent.groupName
                  ? `${selectedEvent.groupName}（${selectedEvent.title}）`
                  : selectedEvent.title}
              </h3>
              <button
                className="sch-modal-close-x"
                onClick={() => setSelectedEvent(null)}
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <div className="sch-modal-badges">
              <span
                className={`sch-modal-badge ${getCategoryColorOnly(
                  selectedEvent.category
                )}`}
              >
                {selectedEvent.category}
              </span>
              {selectedEvent.attrColor && (
                <span
                  className={`sch-modal-badge ${ATTR_COLOR_MAP[selectedEvent.attrColor]}`}
                >
                  {selectedEvent.attrColor}属性
                </span>
              )}
              <span className="sch-modal-badge sch-badge-muted">
                {selectedEvent.sourceLabel}
              </span>
              {renderTodoLinkBadge(
                selectedEvent.todoState,
                selectedEvent.todoStatusLabel
              )}
            </div>

            <div className="sch-modal-body">
              <div className="sch-modal-row">
                <strong>開始：</strong>
                <span>{formatDateTime(selectedEvent.start)}（日本時間）</span>
              </div>
              <div className="sch-modal-row">
                <strong>終了：</strong>
                <span>{formatDateTime(selectedEvent.end)}（日本時間）</span>
              </div>

              {selectedEvent.linkedTodos && selectedEvent.linkedTodos.length > 0 && (
                <div className="sch-modal-linked-todos">
                  <div className="sch-modal-linked-heading">📋 連携中のToDo</div>
                  {selectedEvent.linkedTodos.map((t) => (
                    <div
                      key={t.id}
                      className={`sch-modal-linked-item ${t.isDone ? 'is-done' : ''}`}
                    >
                      <span className="sch-linked-no">No.{t.no}</span>
                      <span className="sch-linked-status">
                        {t.isDone ? '✅ 完了' : t.status}
                      </span>
                      <span className="sch-linked-title">{t.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedEvent.url ? (
                <a
                  href={selectedEvent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sch-source-link"
                >
                  情報の出典を開く ↗
                </a>
              ) : (
                <p className="sch-modal-hint">
                  「予定」シートの毎月サイクルから自動補完された定期イベントです。
                </p>
              )}
            </div>

            <div className="sch-modal-footer">
              <button
                className="sch-modal-close-btn"
                onClick={() => setSelectedEvent(null)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ToDo期限モーダル */}
      {selectedTodoDay && (
        <div className="sch-modal-overlay" onClick={() => setSelectedTodoDay(null)}>
          <div className="sch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sch-modal-header">
              <h3 className="sch-modal-title">
                📋 {selectedTodoDay.date.getMonth() + 1}月
                {selectedTodoDay.date.getDate()}日（
                {WEEKDAYS[selectedTodoDay.date.getDay()]}）期限のToDo
              </h3>
              <button
                className="sch-modal-close-x"
                onClick={() => setSelectedTodoDay(null)}
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <div className="sch-modal-todo-list">
              {selectedTodoDay.todos.map((t) => (
                <div key={t.id} className="sch-modal-todo-item">
                  <div className="sch-day-todo-title">{t.title}</div>
                  <div className="sch-day-todo-meta">
                    {t.category && <span className="sch-meta-pill">{t.category}</span>}
                    {t.target && <span className="sch-meta-pill">対象: {t.target}</span>}
                    <span className="sch-meta-pill">{t.status}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="sch-modal-footer">
              <button
                className="sch-modal-close-btn"
                onClick={() => setSelectedTodoDay(null)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}