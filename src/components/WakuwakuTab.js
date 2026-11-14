import React, { useState } from 'react';

export default function WakuwakuTab({ wakuData }) {
  const [wakuSearchTerm, setWakuSearchTerm] = useState('');
  const [filterAccounts, setFilterAccounts] = useState([]);
  const [hideEmptyFruits, setHideEmptyFruits] = useState(false);

  if (!wakuData || wakuData.length === 0)
    return <div>データがありません。</div>;

  const headers = wakuData[0];

  const accountColumns = [];
  for (let i = 3; i <= 18; i++) {
    accountColumns.push({ index: i, name: headers[i] });
  }

  // 1. 先に「表示されるキャラ（行）」を絞り込む
  const filteredRows = wakuData.filter((row, rIdx) => {
    if (rIdx === 0 || row[0] === 9999 || (!row[0] && !row[1] && !row[2]))
      return false;

    const charName = row[2] ? row[2].toString() : '';
    if (wakuSearchTerm && !charName.includes(wakuSearchTerm)) return false;

    // 手動アカウント選択の判定（選んだアカウントすべてが持っているキャラだけ残す）
    if (filterAccounts.length > 0) {
      const hasAll = filterAccounts.every((cIdx) => {
        const statusIndex = cIdx + 16;
        return (
          row[statusIndex] === true ||
          row[statusIndex] === 1 ||
          row[statusIndex] === 'TRUE'
        );
      });
      if (!hasAll) return false;
    }

    // 🌟追加：スイッチがONのとき、表示対象のアカウントすべてが未厳選（空白）のキャラ行を消す！
    if (hideEmptyFruits) {
      const targetCols =
        filterAccounts.length > 0
          ? filterAccounts
          : accountColumns.map((acc) => acc.index);

      // 対象アカウントのうち、1つでも実が書かれているかチェック
      const hasAnyFruitInRow = targetCols.some((cIdx) => {
        const statusIndex = cIdx + 16;
        const isOwned =
          row[statusIndex] === true ||
          row[statusIndex] === 1 ||
          row[statusIndex] === 'TRUE';
        if (!isOwned) return false;

        const cellValue = row[cIdx];
        return (
          cellValue !== null &&
          cellValue !== undefined &&
          cellValue.toString().trim() !== ''
        );
      });

      // どのアカウントも実を付けていなければ（ツクモの状態）、この行を非表示にする
      if (!hasAnyFruitInRow) return false;
    }

    return true;
  });

  // 2. 表示されるキャラをもとに「表示するアカウント（列）」を決定する
  const displayHeaders = [];
  displayHeaders.push({ index: 0, name: headers[0] }); // No.
  displayHeaders.push({ index: 1, name: headers[1] }); // 属性
  displayHeaders.push({ index: 2, name: headers[2] }); // キャラ名

  for (let i = 3; i <= 18; i++) {
    if (filterAccounts.length > 0 && !filterAccounts.includes(i)) continue;

    let keepColumn = false;

    if (!hideEmptyFruits) {
      if (!wakuSearchTerm) {
        keepColumn = true;
      } else {
        keepColumn = filteredRows.some((row) => {
          const statusIndex = i + 16;
          return (
            row[statusIndex] === true ||
            row[statusIndex] === 1 ||
            row[statusIndex] === 'TRUE'
          );
        });
      }
    } else {
      // スイッチがONの場合：表示されているキャラのうち、1体でも実を付けているアカウント列だけ残す
      keepColumn = filteredRows.some((row) => {
        const statusIndex = i + 16;
        const isOwned =
          row[statusIndex] === true ||
          row[statusIndex] === 1 ||
          row[statusIndex] === 'TRUE';
        if (!isOwned) return false;

        const cellValue = row[i];
        return (
          cellValue !== null &&
          cellValue !== undefined &&
          cellValue.toString().trim() !== ''
        );
      });
    }

    if (keepColumn) {
      displayHeaders.push({ index: i, name: headers[i] });
    }
  }

  return (
    <div className="generic-table-wrapper">
      <div
        className="filter-section"
        style={{ marginBottom: '16px', padding: '12px' }}
      >
        <input
          type="text"
          className="search-input"
          style={{ marginBottom: '12px' }}
          placeholder="キャラ名で検索..."
          value={wakuSearchTerm}
          onChange={(e) => setWakuSearchTerm(e.target.value)}
        />

        <div className="filter-row">
          <div className="account-label-area">
            <span
              className="filter-label"
              style={{ width: 'auto', marginTop: 0 }}
            >
              表示アカウント:
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

        <div className="filter-row" style={{ marginTop: '12px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: '#bbb',
              fontSize: '0.9rem',
            }}
          >
            <input
              type="checkbox"
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              checked={hideEmptyFruits}
              onChange={(e) => setHideEmptyFruits(e.target.checked)}
            />
            厳選していない（空白の）行・列を非表示
          </label>
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table sticky-table">
          <thead>
            <tr>
              {displayHeaders.map((col, i) => (
                <th
                  key={col.index}
                  className={
                    i === 0
                      ? 'freeze-no'
                      : i === 1
                      ? 'freeze-attr'
                      : i === 2
                      ? 'freeze-name'
                      : ''
                  }
                >
                  {col.name !== null ? col.name.toString() : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, index) => {
              const charAttr = row[1];

              return (
                <tr key={index}>
                  {displayHeaders.map((col, i) => {
                    const cIdx = col.index;
                    const cell = row[cIdx];

                    if (cIdx <= 2) {
                      return (
                        <td
                          key={cIdx}
                          className={
                            i === 0
                              ? 'freeze-no'
                              : i === 1
                              ? 'freeze-attr'
                              : i === 2
                              ? 'freeze-name'
                              : ''
                          }
                        >
                          {cIdx === 1 ? (
                            <span className={`attr-label attr-${charAttr}`}>
                              {cell}
                            </span>
                          ) : cell !== null ? (
                            cell.toString()
                          ) : (
                            ''
                          )}
                        </td>
                      );
                    }

                    const statusIndex = cIdx + 16;
                    const hasChar =
                      row[statusIndex] === true ||
                      row[statusIndex] === 1 ||
                      row[statusIndex] === 'TRUE';

                    if (!hasChar)
                      return <td key={cIdx} className="not-owned-cell"></td>;

                    const cellText = cell !== null ? cell.toString() : '';
                    const isGensen = cellText.includes('速必');

                    return (
                      <td key={cIdx} className="read-only-cell">
                        <div
                          className="cell-content-readonly"
                          style={
                            isGensen
                              ? { color: '#e53935', fontWeight: 'bold' }
                              : {}
                          }
                        >
                          {cellText}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
