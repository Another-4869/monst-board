import React, { useState, useMemo } from 'react';

export default function TodoTab({ data }) {
  const [searchTerm, setSearchTerm] = useState('');
  // 🌟 初期状態は「完了以外（残タスク）」を表示
  const [statusFilter, setStatusFilter] = useState('残タスク');
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  // 🌟 並び順：'days'（残日数順） | 'no-asc'（No.昇順） | 'no-desc'（No.降順） | 'priority'（優先度順）
  const [sortBy, setSortBy] = useState('days');
  const [isTwoCol, setIsTwoCol] = useState(true); // 初期2列表示

  if (!data || data.length <= 2) {
    return (
      <div className="generic-table-wrapper">ToDoデータがありません。</div>
    );
  }

  // 🌟 日付から時刻（T15:00:00.000Zなど）を消して「YYYY/MM/DD」に整形する関数
  const formatDate = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const str = val.toString().trim();
    if (str === '無期限') return '無期限';

    if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}/${(d.getMonth() + 1)
          .toString()
          .padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
      }
    }
    // 「2026年11月15日」のような表記も「2026/11/15」に揃える
    const jpMatch = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (jpMatch) {
      return `${jpMatch[1]}/${jpMatch[2].padStart(
        2,
        '0'
      )}/${jpMatch[3].padStart(2, '0')}`;
    }
    return str;
  };

  // 🌟 1. スプレッドシートの3行目以降（インデックス2〜）からタスク一覧を抽出＆集計
  const { tasks, counts, categories } = useMemo(() => {
    const list = [];
    const catSet = new Set();
    let notStarted = 0;
    let inProgress = 0;
    let completed = 0;

    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      const rawNo = row[0];
      const startDate = formatDate(row[1]); // B列: 開始
      const dueDate = formatDate(row[2]); // C列: 期限
      const endDate = formatDate(row[3]); // D列: 終了
      const rawDays = row[4]; // E列: 残日数
      const priority = row[5] ? row[5].toString().trim() : ''; // F列: 優先度
      const target =
        row[6] !== null && row[6] !== undefined ? row[6].toString().trim() : ''; // G列: 対象
      const category = row[7] ? row[7].toString().trim() : ''; // H列: カテゴリ
      const taskName = row[8] ? row[8].toString().trim() : ''; // I列: タスク
      const status = row[9] ? row[9].toString().trim() : '未着手'; // J列: ステータス
      const note = row[10] ? row[10].toString().trim() : ''; // K列: 備考

      // 🌟 修正：No.だけ振ってある307番以降の予備行（タスク名が空欄の行）を完全にスキップ！
      if (!taskName) continue;

      const no = Number(rawNo) || i;

      // 残日数の数値化（空欄や無期限は null 扱い）
      let remainingDays = null;
      if (
        rawDays !== null &&
        rawDays !== undefined &&
        rawDays !== '' &&
        !isNaN(Number(rawDays))
      ) {
        remainingDays = Number(rawDays);
      }

      // 優先度の数値化（1.最優先, 2.高, 3.中, 4.低 などをソートしやすくする）
      const prioMatch = priority.match(/\d+/);
      const priorityNum = prioMatch ? Number(prioMatch[0]) : 99;

      // ステータス件数のカウント
      if (status === '完了') {
        completed++;
      } else if (status === '対応中') {
        inProgress++;
      } else {
        notStarted++;
      }

      if (category) catSet.add(category);

      list.push({
        id: `${no}-${i}`,
        no,
        startDate,
        dueDate,
        endDate,
        remainingDays,
        priority,
        priorityNum,
        target,
        category,
        taskName,
        status,
        note,
      });
    }

    return {
      tasks: list,
      counts: {
        remainingTotal: notStarted + inProgress,
        notStarted,
        inProgress,
        completed,
        all: list.length,
      },
      categories: ['すべて', ...Array.from(catSet)],
    };
  }, [data]);

  // 🌟 2. フィルタリングと並び替え（残日数順 / No.順 / 優先度順）
  const filteredAndSortedTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      // ステータス絞り込み
      if (statusFilter === '残タスク' && t.status === '完了') return false;
      if (statusFilter === '未着手' && t.status !== '未着手') return false;
      if (statusFilter === '対応中' && t.status !== '対応中') return false;
      if (statusFilter === '完了' && t.status !== '完了') return false;

      // カテゴリ絞り込み
      if (selectedCategory !== 'すべて' && t.category !== selectedCategory) {
        return false;
      }

      // キーワード検索
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTask = t.taskName.toLowerCase().includes(term);
        const matchCat = t.category.toLowerCase().includes(term);
        const matchTarget = t.target.toLowerCase().includes(term);
        const matchNote = t.note.toLowerCase().includes(term);
        const matchNo = t.no.toString().includes(term);
        if (!matchTask && !matchCat && !matchTarget && !matchNote && !matchNo) {
          return false;
        }
      }

      return true;
    });

    // 並び替え処理
    return [...filtered].sort((a, b) => {
      if (sortBy === 'days') {
        // 残日数が少ない順（無期限や空欄は一番後ろへ回す）
        const aDays = a.remainingDays !== null ? a.remainingDays : 999999;
        const bDays = b.remainingDays !== null ? b.remainingDays : 999999;
        if (aDays !== bDays) return aDays - bDays;
        return a.no - b.no; // 残日数が同じなら No.順
      }
      if (sortBy === 'no-asc') {
        return a.no - b.no;
      }
      if (sortBy === 'no-desc') {
        return b.no - a.no;
      }
      if (sortBy === 'priority') {
        if (a.priorityNum !== b.priorityNum)
          return a.priorityNum - b.priorityNum;
        const aDays = a.remainingDays !== null ? a.remainingDays : 999999;
        const bDays = b.remainingDays !== null ? b.remainingDays : 999999;
        if (aDays !== bDays) return aDays - bDays;
        return a.no - b.no;
      }
      return 0;
    });
  }, [tasks, statusFilter, selectedCategory, searchTerm, sortBy]);

  // 残日数の緊急度に応じたクラス判定
  const getDaysBadgeClass = (days, dueDate, status) => {
    if (status === '完了') return 'days-done';
    if (days === null || dueDate === '無期限') return 'days-infinite';
    if (days <= 7) return 'days-urgent'; // 7日以内は赤
    if (days <= 30) return 'days-warning'; // 30日以内はオレンジ
    return 'days-normal';
  };

  // 優先度に応じたクラス判定
  const getPriorityClass = (prioNum) => {
    if (prioNum === 1) return 'prio-1';
    if (prioNum === 2) return 'prio-2';
    if (prioNum === 3) return 'prio-3';
    return 'prio-4';
  };

  // ステータスに応じたクラス判定
  const getStatusClass = (status) => {
    if (status === '完了') return 'status-done';
    if (status === '対応中') return 'status-progress';
    return 'status-todo';
  };

  const progressRate =
    counts.all > 0 ? Math.round((counts.completed / counts.all) * 100) : 0;

  return (
    <div className="todo-wrapper">
      {/* 🌟 上部：残タスク＆ステータス別サマリーボード（タップで切り替え可能） */}
      <div className="todo-summary-board">
        <button
          className={`todo-stat-card stat-remaining ${
            statusFilter === '残タスク' ? 'selected' : ''
          }`}
          onClick={() => setStatusFilter('残タスク')}
        >
          <div className="todo-stat-label">🔥 残タスク合計</div>
          <div className="todo-stat-value">
            {counts.remainingTotal} <span className="todo-stat-unit">件</span>
          </div>
        </button>

        <button
          className={`todo-stat-card stat-not-started ${
            statusFilter === '未着手' ? 'selected' : ''
          }`}
          onClick={() =>
            setStatusFilter(statusFilter === '未着手' ? '残タスク' : '未着手')
          }
        >
          <div className="todo-stat-label">🟦 未着手</div>
          <div className="todo-stat-value">
            {counts.notStarted} <span className="todo-stat-unit">件</span>
          </div>
        </button>

        <button
          className={`todo-stat-card stat-in-progress ${
            statusFilter === '対応中' ? 'selected' : ''
          }`}
          onClick={() =>
            setStatusFilter(statusFilter === '対応中' ? '残タスク' : '対応中')
          }
        >
          <div className="todo-stat-label">🟨 対応中</div>
          <div className="todo-stat-value">
            {counts.inProgress} <span className="todo-stat-unit">件</span>
          </div>
        </button>

        <button
          className={`todo-stat-card stat-completed ${
            statusFilter === '完了' ? 'selected' : ''
          }`}
          onClick={() =>
            setStatusFilter(statusFilter === '完了' ? '残タスク' : '完了')
          }
        >
          <div className="todo-stat-label">
            🟩 完了（達成率 {progressRate}%）
          </div>
          <div className="todo-stat-value">
            {counts.completed}{' '}
            <span className="todo-stat-unit">/ {counts.all} 件</span>
          </div>
        </button>
      </div>

      {/* 🌟 中部：検索＆並び替え＆カテゴリ絞り込み（上部固定） */}
      <div
        className="filter-section"
        style={{ marginBottom: '16px', padding: '12px' }}
      >
        <div className="orb-search-bar-row" style={{ flexWrap: 'wrap' }}>
          <input
            type="text"
            className="search-input"
            style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}
            placeholder="タスク名・カテゴリ・対象・No.で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* 並び順切り替えボタングループ */}
          <div className="todo-sort-group">
            <button
              className={`orb-sort-btn ${
                sortBy === 'days' ? 'active-sort' : ''
              }`}
              onClick={() => setSortBy('days')}
            >
              ⏳ 残日数順
            </button>
            <button
              className={`orb-sort-btn ${
                sortBy.startsWith('no') ? 'active-sort' : ''
              }`}
              onClick={() =>
                setSortBy(sortBy === 'no-asc' ? 'no-desc' : 'no-asc')
              }
            >
              {sortBy === 'no-desc' ? '🔢 No.降順' : '🔢 No.順'}
            </button>
            <button
              className={`orb-sort-btn ${
                sortBy === 'priority' ? 'active-sort' : ''
              }`}
              onClick={() => setSortBy('priority')}
            >
              🔥 優先度順
            </button>
            <button
              className="orb-sort-btn"
              onClick={() => setIsTwoCol(!isTwoCol)}
            >
              {isTwoCol ? '📋 1列表示' : '🗂️ 2列表示'}
            </button>
          </div>
        </div>

        {/* ステータス＆カテゴリフィルター */}
        <div
          className="filter-row"
          style={{ alignItems: 'center', marginTop: '8px' }}
        >
          <span
            className="filter-label"
            style={{ width: 'auto', marginTop: 0 }}
          >
            表示:
          </span>
          <div className="attr-filters">
            {['残タスク', '未着手', '対応中', '完了', 'すべて'].map((st) => (
              <button
                key={st}
                className={`attr-btn ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === '残タスク' ? '🔥 残タスク(完了以外)' : st}
              </button>
            ))}
          </div>
        </div>

        <div
          className="filter-row"
          style={{ alignItems: 'center', marginTop: '6px' }}
        >
          <span
            className="filter-label"
            style={{ width: 'auto', marginTop: 0 }}
          >
            カテゴリ:
          </span>
          <div className="attr-filters">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`attr-btn ${
                  selectedCategory === cat ? 'active' : ''
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 🌟 下部：ToDoカード一覧 */}
      {filteredAndSortedTasks.length === 0 ? (
        <div
          className="generic-table-wrapper"
          style={{ textAlign: 'center', color: '#888', padding: '32px' }}
        >
          該当するタスクがありません。
        </div>
      ) : (
        <div className={`todo-grid ${isTwoCol ? 'two-col' : 'one-col'}`}>
          {filteredAndSortedTasks.map((task) => {
            const statusClass = getStatusClass(task.status);
            const daysClass = getDaysBadgeClass(
              task.remainingDays,
              task.dueDate,
              task.status
            );
            const prioClass = getPriorityClass(task.priorityNum);

            return (
              <div key={task.id} className={`todo-card ${statusClass}`}>
                {/* 上段：No.・ステータス・優先度・カテゴリ・対象 ＆ 残日数バッジ */}
                <div className="todo-card-top">
                  <div className="todo-badges-left">
                    <span className="todo-no">No.{task.no}</span>
                    <span className={`todo-status-badge ${statusClass}`}>
                      {task.status}
                    </span>
                    {task.priority && (
                      <span className={`todo-prio-badge ${prioClass}`}>
                        優先度: {task.priority}
                      </span>
                    )}
                    {task.category && (
                      <span className="todo-cat-badge">{task.category}</span>
                    )}
                    {task.target && (
                      <span className="todo-target-badge">
                        対象: {task.target}
                      </span>
                    )}
                  </div>

                  {/* 残日数バッジ */}
                  <div className={`todo-days-badge ${daysClass}`}>
                    {task.status === '完了' ? (
                      '✅ 完了'
                    ) : task.remainingDays !== null ? (
                      task.remainingDays < 0 ? (
                        `⚠️ 期限切れ (${Math.abs(task.remainingDays)}日超過)`
                      ) : task.remainingDays === 0 ? (
                        '🔥 今日まで！'
                      ) : (
                        <>
                          残り <strong>{task.remainingDays}</strong> 日
                        </>
                      )
                    ) : (
                      '♾️ 無期限'
                    )}
                  </div>
                </div>

                {/* 中段：タスク名 */}
                <div className="todo-task-title">{task.taskName}</div>

                {/* 下段：開始日・期限日・終了日 ＆ 備考 */}
                <div className="todo-card-bottom">
                  <div className="todo-dates">
                    {task.startDate && <span>開始: {task.startDate}</span>}
                    {task.dueDate && (
                      <span>
                        期限: <strong>{task.dueDate}</strong>
                      </span>
                    )}
                    {task.endDate && <span>終了: {task.endDate}</span>}
                  </div>

                  {task.note && <div className="todo-note">📝 {task.note}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
