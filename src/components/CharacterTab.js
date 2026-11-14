import React, { useState, useEffect } from 'react';

export default function CharacterTab({ data }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAttr, setFilterAttr] = useState('すべて');
  const [filterAccounts, setFilterAccounts] = useState([]);
  const [gachaOptions, setGachaOptions] = useState([]);
  const [selectedGachas, setSelectedGachas] = useState([]);
  const [isGachaMenuOpen, setIsGachaMenuOpen] = useState(false);
  const [isTwoCol, setIsTwoCol] = useState(true); // 🌟 初期状態で2列表示をONにする

  useEffect(() => {
    if (data) {
      const uniqueGachas = new Set();
      data.forEach((row, rIdx) => {
        if (rIdx === 0 || !row[2] || row[0] === 9999) return;
        const gachaName = row[5] ? row[5].toString().trim() : '(空白)';
        uniqueGachas.add(gachaName);
      });
      const customOrder = [
        '超獣神祭',
        '激獣神祭',
        '彩獣神祭',
        'オリトラ',
        'モンジェネ',
        'モンコレDX',
        '火限定',
        '水限定',
        '木限定',
        '光限定',
        '闇限定',
        'αガチャ',
        'コラボ',
        '(空白)',
      ];
      const gachaList = Array.from(uniqueGachas).sort((a, b) => {
        const indexA = customOrder.indexOf(a);
        const indexB = customOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b, 'ja');
      });
      setGachaOptions(gachaList);
      setSelectedGachas(gachaList);
    }
  }, [data]);

  if (!data) return <div>キャラシートが見つかりません。</div>;

  const headers = data[0];
  const bikoIndex = headers.indexOf('備考');
  const shojiIndex = headers.indexOf('所持数');
  const checkStartCol = bikoIndex !== -1 ? bikoIndex + 1 : 7;
  const checkEndCol = shojiIndex !== -1 ? shojiIndex - 1 : headers.length - 2;

  const accountColumns = [];
  for (let i = checkStartCol; i <= checkEndCol; i++) {
    accountColumns.push({ index: i, name: headers[i] });
  }

  return (
    <div className="character-wrapper">
      {/* 🌟 消えてしまっていた filter-section を復活！ */}
      <div className="filter-section">
        {/* 🌟 検索バーと2列切り替えボタンを横並びにする */}
        <div className="orb-search-bar-row" style={{ marginBottom: '12px' }}>
          <input
            type="text"
            className="search-input"
            style={{ marginBottom: 0 }}
            placeholder="キャラ名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className="orb-sort-btn"
            onClick={() => setIsTwoCol(!isTwoCol)}
          >
            {isTwoCol ? '📋 1列表示' : '🗂️ 2列表示'}
          </button>
        </div>

        <div className="filter-row">
          <span className="filter-label">属性:</span>
          <div className="attr-filters">
            {['すべて', '火', '水', '木', '光', '闇'].map((attr) => (
              <button
                key={attr}
                className={`attr-btn ${filterAttr === attr ? 'active' : ''} ${
                  attr !== 'すべて' ? 'attr-' + attr : ''
                }`}
                onClick={() => setFilterAttr(attr)}
              >
                {attr}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row" style={{ position: 'relative' }}>
          <span className="filter-label">ガチャ:</span>
          <button
            className="dropdown-toggle-btn"
            onClick={() => setIsGachaMenuOpen(!isGachaMenuOpen)}
          >
            選択中のガチャ: {selectedGachas.length} / {gachaOptions.length} ▼
          </button>
          {isGachaMenuOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-actions">
                <button onClick={() => setSelectedGachas(gachaOptions)}>
                  すべて選択
                </button>
                <button onClick={() => setSelectedGachas([])}>クリア</button>
              </div>
              <div className="dropdown-list">
                {gachaOptions.map((gacha) => (
                  <label key={gacha} className="dropdown-item">
                    <input
                      type="checkbox"
                      checked={selectedGachas.includes(gacha)}
                      onChange={() => {
                        if (selectedGachas.includes(gacha))
                          setSelectedGachas(
                            selectedGachas.filter((g) => g !== gacha)
                          );
                        else setSelectedGachas([...selectedGachas, gacha]);
                      }}
                    />
                    {gacha}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="filter-row">
          <div className="account-label-area">
            <span
              className="filter-label"
              style={{ width: 'auto', marginTop: 0 }}
            >
              所持アカウント:
            </span>
            <div className="tiny-action-btns">
              <button
                onClick={() =>
                  setFilterAccounts(accountColumns.map((acc) => acc.index))
                }
              >
                全選択
              </button>
              <button onClick={() => setFilterAccounts([])}>クリア</button>
            </div>
          </div>
          <div className="account-filters">
            {accountColumns.map((acc) => {
              const isActive = filterAccounts.includes(acc.index);
              return (
                <button
                  key={acc.index}
                  className={`account-filter-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (isActive)
                      setFilterAccounts(
                        filterAccounts.filter((id) => id !== acc.index)
                      );
                    else setFilterAccounts([...filterAccounts, acc.index]);
                  }}
                >
                  {acc.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🌟 ここに2列切り替えクラス（two-col / one-col）をセット！ */}
      <div
        className={`char-list char-grid ${isTwoCol ? 'two-col' : 'one-col'}`}
      >
        {data.map((row, rIdx) => {
          if (rIdx === 0 || !row[2] || row[0] === 9999) return null;
          const charName = row[2] ? row[2].toString() : '';
          const charAttr = row[1];
          const gachaType = row[5] ? row[5].toString().trim() : '(空白)';

          if (searchTerm && !charName.includes(searchTerm)) return null;
          if (filterAttr !== 'すべて' && charAttr !== filterAttr) return null;
          if (!selectedGachas.includes(gachaType)) return null;
          if (filterAccounts.length > 0) {
            const hasAll = filterAccounts.every(
              (cIdx) =>
                row[cIdx] === true || row[cIdx] === 1 || row[cIdx] === 'TRUE'
            );
            if (!hasAll) return null;
          }

          let ownedCount = 0;
          for (let i = checkStartCol; i <= checkEndCol; i++) {
            if (row[i] === true || row[i] === 1 || row[i] === 'TRUE')
              ownedCount++;
          }

          return (
            <div key={rIdx} className="char-card">
              <div className="char-card-header">
                <div className="char-info">
                  <span className="char-no">No.{row[0]}</span>
                  <span className={`attr attr-${row[1]}`}>{row[1]}</span>
                  <span className="char-name">{row[2]}</span>
                </div>
                <div className="char-count">
                  所持 <span className="count-number">{ownedCount}</span> 体
                </div>
              </div>
              <div className="char-meta">
                ガチャ: {row[5]} | 備考: {row[6] || '-'}
              </div>

              <div className="checkbox-group">
                {headers.map((head, cIdx) => {
                  if (cIdx >= checkStartCol && cIdx <= checkEndCol) {
                    const isChecked =
                      row[cIdx] === true ||
                      row[cIdx] === 1 ||
                      row[cIdx] === 'TRUE';
                    return (
                      <div
                        key={cIdx}
                        className={`check-label read-only-badge ${
                          isChecked ? 'checked' : ''
                        }`}
                      >
                        {head}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
