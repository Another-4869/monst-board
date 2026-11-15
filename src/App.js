import React, { useState, useEffect, useMemo } from 'react';
import './style.css';

import CharacterTab from './components/CharacterTab';
import WakuwakuTab from './components/WakuwakuTab';
import FormationTab from './components/FormationTab';
import OrbTab from './components/OrbTab';
import TodoTab from './components/TodoTab';
import ChangelogTab, { CHANGELOG_DATA } from './components/ChangelogTab';

// ChangelogTab.js の一番上にある最新バージョンと日付を自動取得
const LATEST_RELEASE = CHANGELOG_DATA[0] || {
  version: 'Ver.1.0.0',
  date: '2026/11/15',
};

// スプレッドシートの順番に合わせてToDoを先頭に配置
const NAV_ITEMS = [
  { id: 'ホーム', label: 'ホーム', icon: '🏠', desc: 'メインメニュー・直近ToDo確認' },
  { id: 'ToDo', label: 'ToDo', icon: '📋', desc: 'タスク進捗・期限・対象別管理' },
  { id: 'キャラ', label: 'キャラ', icon: '👾', desc: '各アカウントの所持キャラ一覧' },
  { id: '実', label: '厳選', icon: '🍎', desc: 'わくわくの実の厳選状況テーブル' },
  { id: '編成', label: '編成', icon: '⚔️', desc: 'クエスト別の周回・攻略パーティ' },
  { id: 'オーブ', label: 'オーブ', icon: '💎', desc: '各アカウントのオーブ数・増減履歴' },
];

export default function App() {
  const [sheetData, setSheetData] = useState(null);
  const [isFirstLoading, setIsFirstLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('');

  // 初期表示を「ホーム（メインメニュー）」に設定
  const [activeTab, setActiveTab] = useState('ホーム');
  // 左側のスライドメニュー（ハンバーガーメニュー）の開閉状態
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const API_URL =
    'https://script.google.com/macros/s/AKfycbwib0t7ry7W0YFitVtnwLp0FFI1hhMBMFNfpaWz_LqGRau5nB3PdnP2GGxIytCmRnvziA/exec';

  const fetchLatestData = () => {
    setIsSyncing(true);
    fetch(API_URL)
      .then((res) => res.json())
      .then((result) => {
        setSheetData(result.data);

        const now = new Date();
        const timeString = `${
          now.getMonth() + 1
        }/${now.getDate()} ${now.getHours()}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;
        setLastSyncTime(timeString);

        localStorage.setItem('monstData', JSON.stringify(result.data));
        localStorage.setItem('monstLastSync', timeString);

        setIsFirstLoading(false);
        setIsSyncing(false);
      })
      .catch((err) => {
        console.error('同期エラー:', err);
        setIsSyncing(false);
        setIsFirstLoading(false);
      });
  };

  useEffect(() => {
    const savedData = localStorage.getItem('monstData');
    const savedTime = localStorage.getItem('monstLastSync');

    if (savedData) {
      setSheetData(JSON.parse(savedData));
      setLastSyncTime(savedTime || '不明');
      setIsFirstLoading(false);
    }

    fetchLatestData();
  }, []);

  // ページ切り替え時にメニューを閉じて一番上へスクロール
  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 日付整形ヘルパー
  const formatDate = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const str = val.toString().trim();
    if (str === '無期限') return '無期限';
    if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }
    }
    return str;
  };

  // ホーム画面用のサマリー＆期限が近いToDo抽出
  const dashboardStats = useMemo(() => {
    if (!sheetData) return null;

    // 1. ToDoデータの集計
    const todoRaw = sheetData['ToDo'] || [];
    let remainingCount = 0;
    let urgentCount = 0;
    let completedCount = 0;
    const activeTasks = [];

    for (let i = 2; i < todoRaw.length; i++) {
      const row = todoRaw[i];
      if (!row) continue;
      const taskName = row[8] ? row[8].toString().trim() : '';
      if (!taskName) continue;

      const status = row[9] ? row[9].toString().trim() : '未着手';
      const rawDays = row[4];
      const dueDate = formatDate(row[2]);
      const target = row[6] !== null && row[6] !== undefined ? row[6].toString().trim() : '';
      const category = row[7] ? row[7].toString().trim() : '';
      const priority = row[5] ? row[5].toString().trim() : '';

      let remainingDays = null;
      if (rawDays !== null && rawDays !== undefined && rawDays !== '' && !isNaN(Number(rawDays))) {
        remainingDays = Number(rawDays);
      }

      if (status === '完了') {
        completedCount++;
      } else {
        remainingCount++;
        if (remainingDays !== null && remainingDays <= 7) {
          urgentCount++;
        }
        activeTasks.push({
          id: `${row[0] || i}-${i}`,
          no: Number(row[0]) || i,
          taskName,
          status,
          dueDate,
          remainingDays,
          target,
          category,
          priority,
        });
      }
    }

    // 残日数が少ない順（期限が迫っている順）に並び替え、上位6件を取得
    activeTasks.sort((a, b) => {
      const aDays = a.remainingDays !== null ? a.remainingDays : 999999;
      const bDays = b.remainingDays !== null ? b.remainingDays : 999999;
      if (aDays !== bDays) return aDays - bDays;
      return a.no - b.no;
    });

    const totalTodo = remainingCount + completedCount;
    const todoRate = totalTodo > 0 ? Math.round((completedCount / totalTodo) * 100) : 0;

    // 2. キャラ登録数
    const charRaw = sheetData['キャラ'] || [];
    let charCount = 0;
    for (let i = 2; i < charRaw.length; i++) {
      if (charRaw[i] && charRaw[i][2]) charCount++;
    }

    return {
      remainingCount,
      urgentCount,
      completedCount,
      totalTodo,
      todoRate,
      urgentTasks: activeTasks.slice(0, 6),
      charCount,
    };
  }, [sheetData]);

  if (isFirstLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <div className="loading-text">初回データを読み込み中...</div>
        <div style={{ color: '#666', marginTop: '10px', fontSize: '0.85rem' }}>
          ※初回のみ30秒ほどかかります
        </div>
      </div>
    );
  }

  if (!sheetData) {
    return (
      <div className="loading-container">
        <div className="error-text">データの取得に失敗しました。</div>
      </div>
    );
  }

  // ホーム画面（メインメニュー）の描画
  const renderHomeDashboard = () => {
    const sheetButtons = NAV_ITEMS.filter((item) => item.id !== 'ホーム');

    return (
      <div className="home-wrapper">
        {/* 1. メインタイトル＆バージョン＆バージョン更新日 */}
        <div className="home-hero">
          <h2 className="home-title">モンスト管理ボード</h2>
          <div className="home-meta-row">
            <span
              className="home-version-badge"
              onClick={() => handleSelectTab('変更履歴')}
              style={{ cursor: 'pointer' }}
              title="変更履歴を見る"
            >
              {LATEST_RELEASE.version}
            </span>
            <span className="home-sync-info">
              最終更新: {LATEST_RELEASE.date}
            </span>
          </div>
        </div>

        {/* 2. クイックステータスサマリー */}
        {dashboardStats && (
          <div className="home-stats-grid">
            <div className="home-stat-box" onClick={() => handleSelectTab('ToDo')}>
              <span className="home-stat-label">🔥 残タスク</span>
              <span className="home-stat-num">
                {dashboardStats.remainingCount} <small>件</small>
              </span>
            </div>
            <div className="home-stat-box urgent" onClick={() => handleSelectTab('ToDo')}>
              <span className="home-stat-label">⏰ 7日以内の期限</span>
              <span className="home-stat-num">
                {dashboardStats.urgentCount} <small>件</small>
              </span>
            </div>
            <div className="home-stat-box done" onClick={() => handleSelectTab('ToDo')}>
              <span className="home-stat-label">✅ ToDo達成率</span>
              <span className="home-stat-num">
                {dashboardStats.todoRate} <small>%</small>
              </span>
            </div>
            <div className="home-stat-box" onClick={() => handleSelectTab('キャラ')}>
              <span className="home-stat-label">👾 登録キャラ数</span>
              <span className="home-stat-num">
                {dashboardStats.charCount} <small>体</small>
              </span>
            </div>
          </div>
        )}

        {/* 3. 各ページ（シート）への遷移メニュー */}
        <div className="home-section">
          <h3 className="home-section-title">📂 シート・ページ一覧</h3>
          <div className="home-nav-list">
            {sheetButtons.map((item) => (
              <button
                key={item.id}
                className="home-nav-card"
                onClick={() => handleSelectTab(item.id)}
              >
                <div className="home-nav-left">
                  <span className="home-nav-icon">{item.icon}</span>
                  <div className="home-nav-text">
                    <span className="home-nav-name">{item.label}</span>
                    <span className="home-nav-desc">{item.desc}</span>
                  </div>
                </div>
                <div className="home-nav-right">
                  {item.id === 'ToDo' && dashboardStats && (
                    <span className="home-nav-badge">
                      残 {dashboardStats.remainingCount} 件
                    </span>
                  )}
                  <span className="home-nav-arrow">→</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 4. 期限が短いToDoピックアップ */}
        {dashboardStats && dashboardStats.urgentTasks.length > 0 && (
          <div className="home-section">
            <div className="home-section-header">
              <h3 className="home-section-title">⏳ 期限が近いToDo（直近ピックアップ）</h3>
              <button
                className="home-more-link"
                onClick={() => handleSelectTab('ToDo')}
              >
                すべて見る →
              </button>
            </div>
            <div className="home-urgent-list">
              {dashboardStats.urgentTasks.map((task) => {
                const isUrgent = task.remainingDays !== null && task.remainingDays <= 7;
                return (
                  <div
                    key={task.id}
                    className={`home-urgent-card ${isUrgent ? 'urgent-border' : ''}`}
                    onClick={() => handleSelectTab('ToDo')}
                  >
                    <div className="home-urgent-main">
                      <span className="home-urgent-title">{task.taskName}</span>
                      <div className="home-urgent-tags">
                        {task.category && (
                          <span className="todo-cat-badge">{task.category}</span>
                        )}
                        {task.target && (
                          <span className="todo-target-badge">対象: {task.target}</span>
                        )}
                      </div>
                    </div>
                    <div className="home-urgent-right">
                      <span
                        className={`todo-days-badge ${
                          isUrgent ? 'days-urgent' : 'days-warning'
                        }`}
                      >
                        {task.remainingDays === null ? (
                          '♾️ 無期限'
                        ) : task.remainingDays < 0 ? (
                          `⚠️ ${Math.abs(task.remainingDays)}日超過`
                        ) : task.remainingDays === 0 ? (
                          '🔥 今日まで！'
                        ) : (
                          <>
                            残り <strong>{task.remainingDays}</strong> 日
                          </>
                        )}
                      </span>
                      {task.dueDate && (
                        <span className="home-urgent-date">期限: {task.dueDate}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'ホーム':
        return renderHomeDashboard();
      case 'ToDo':
        return <TodoTab data={sheetData['ToDo']} />;
      case 'キャラ':
        return <CharacterTab data={sheetData['キャラ']} />;
      case '実':
        return <WakuwakuTab wakuData={sheetData['実']} />;
      case '編成':
        return <FormationTab data={sheetData['編成']} />;
      case 'オーブ':
        return <OrbTab data={sheetData['オーブ推移'] || sheetData['オーブ']} />;
      case '変更履歴':
        return <ChangelogTab />;
      default:
        return renderHomeDashboard();
    }
  };

  const currentNav =
    activeTab === '変更履歴'
      ? { icon: '🕒', label: '変更履歴' }
      : NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="app-container">
      {/* 上部固定ヘッダー（左：☰ボタン＋タイトル、右：同期ボタン） */}
      <header className="app-header sticky-header">
        <div className="header-top">
          <div className="header-left">
            <button
              className="hamburger-btn"
              onClick={() => setIsMenuOpen(true)}
              aria-label="メニューを開く"
            >
              ☰
            </button>
            <h1
              className="app-logo-title"
              onClick={() => handleSelectTab('ホーム')}
              title="ホームへ戻る"
            >
              モンスト管理ボード
            </h1>
            <span className="current-page-badge">
              {currentNav.icon} {currentNav.label}
            </span>
          </div>

          <div className="sync-status">
            {isSyncing ? (
              <span className="syncing-text">🔄 同期中...</span>
            ) : (
              <button className="sync-btn" onClick={fetchLatestData}>
                最新: {lastSyncTime} ↻
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 左から出てくるスライドメニュー（ドロワー） */}
      {isMenuOpen && (
        <div className="drawer-overlay" onClick={() => setIsMenuOpen(false)}>
          <aside className="drawer-menu" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <div className="drawer-title">モンスト管理ボード</div>
                <div className="drawer-version">
                  {LATEST_RELEASE.version} ({LATEST_RELEASE.date})
                </div>
              </div>
              <button
                className="drawer-close-btn"
                onClick={() => setIsMenuOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="drawer-nav-list">
              <div className="drawer-section-label">メニュー</div>
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className={`drawer-nav-item ${
                    activeTab === item.id ? 'active' : ''
                  }`}
                  onClick={() => handleSelectTab(item.id)}
                >
                  <span className="drawer-item-icon">{item.icon}</span>
                  <span className="drawer-item-label">{item.label}</span>
                  {item.id === 'ToDo' && dashboardStats && (
                    <span className="drawer-item-count">
                      {dashboardStats.remainingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* 🌟 左メニューの一番下に「変更履歴」ボタンを配置 */}
            <div className="drawer-footer">
              <button
                className={`drawer-changelog-btn ${
                  activeTab === '変更履歴' ? 'active' : ''
                }`}
                onClick={() => handleSelectTab('変更履歴')}
              >
                <span className="drawer-item-icon">🕒</span>
                <span className="drawer-item-label">変更履歴</span>
                <span className="drawer-changelog-ver">
                  {LATEST_RELEASE.version}
                </span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="tab-content">{renderTabContent()}</main>
    </div>
  );
}