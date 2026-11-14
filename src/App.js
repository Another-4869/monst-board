import React, { useState, useEffect } from 'react';
import './style.css';

import CharacterTab from './components/CharacterTab';
import WakuwakuTab from './components/WakuwakuTab';
import FormationTab from './components/FormationTab';
import OrbTab from './components/OrbTab';
import TodoTab from './components/TodoTab';

export default function App() {
  const [sheetData, setSheetData] = useState(null);
  const [isFirstLoading, setIsFirstLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('');

  const [activeTab, setActiveTab] = useState('キャラ');
  const TABS = ['キャラ', '実', '編成', 'オーブ', 'ToDo'];

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'キャラ':
        return <CharacterTab data={sheetData['キャラ']} />;
      case '実':
        return <WakuwakuTab wakuData={sheetData['実']} />;
      case '編成':
        return <FormationTab data={sheetData['編成']} />;
      case 'オーブ':
        // 「オーブ推移」シートがあれば優先し、なければ「オーブ」シートを読む
        return <OrbTab data={sheetData['オーブ推移'] || sheetData['オーブ']} />;
      case 'ToDo':
        return <TodoTab data={sheetData['ToDo']} />;
      default:
        return <div>タブが見つかりません</div>;
    }
  };

  return (
    <div className="app-container">
      {/* 🌟 1. タイトルと同期ボタンだけを <header> に入れて先に閉じる */}
      <header className="app-header">
        <div className="header-top">
          <h1>モンスト管理ボード</h1>

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

      {/* 🌟 2. タブメニューを <header> の外に出し、sticky-tabs を追加 */}
      <nav className="tab-menu sticky-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === '実' ? '厳選' : tab}
          </button>
        ))}
      </nav>

      <main className="tab-content">{renderTabContent()}</main>
    </div>
  );
}
