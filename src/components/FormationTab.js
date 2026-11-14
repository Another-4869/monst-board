import React, { useState } from 'react';

export default function FormationTab({ data }) {
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [searchTerm, setSearchTerm] = useState('');
  const [hideEmptyQuests, setHideEmptyQuests] = useState(true);
  const [showHiddenQuests, setShowHiddenQuests] = useState(false); // チェックを外した編成も一時的に見るスイッチ

  if (!data || data.length <= 1) {
    return (
      <div className="generic-table-wrapper">編成データがありません。</div>
    );
  }

  const VALID_ATTRS = ['火', '水', '木', '光', '闇'];

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

  const detectFallbackAttr = (questName, slots) => {
    const allCrests = slots.map((s) => s.crest).join(' ');
    if (allCrests.includes('対火') || questName.includes('火獄')) return '火';
    if (allCrests.includes('対水') || questName.includes('水獄')) return '水';
    if (allCrests.includes('対木') || questName.includes('木獄')) return '木';
    if (allCrests.includes('対光') || questName.includes('光獄')) return '光';
    if (allCrests.includes('対闇') || questName.includes('闇獄')) return '闇';
    return 'default';
  };

  // チェックボックスがONかどうかを判定する関数
  const isChecked = (val) => {
    return (
      val === true ||
      val === 1 ||
      (val && val.toString().trim().toUpperCase() === 'TRUE')
    );
  };

  const quests = [];
  let currentCategory = '';
  let currentQuestObj = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    // 🌟 A列に「表示」が追加されたため、列番号を1つずつ右へシフト
    const displayCell = row[0]; // A列: 表示
    const rawCat = row[1] ? row[1].toString().trim() : ''; // B列: カテゴリ
    const rawQuestCell = row[2] ? row[2].toString().trim() : ''; // C列: クエスト名・属性
    const slotLabel = row[3] ? row[3].toString().trim() : ''; // D列: 枠 (1st〜4th)
    const account =
      row[4] !== null && row[4] !== undefined ? row[4].toString().trim() : ''; // E列: アカ
    const charName = row[5] ? row[5].toString().trim() : ''; // F列: キャラ名
    const fruits = row[6] ? row[6].toString().trim() : ''; // G列: 実
    const crest = row[7] ? row[7].toString().trim() : ''; // H列: 紋章
    const guardian = row[8] ? row[8].toString().trim() : ''; // I列: 守護獣
    const updatedAt = formatDate(row[9]); // J列: 更新日
    const note = row[10] ? row[10].toString().trim() : ''; // K列: 備考

    // B列〜K列がすべて空欄ならスキップ（A列のチェックボックスだけ残っている空白行も無視する）
    if (
      !rawCat &&
      !rawQuestCell &&
      !slotLabel &&
      !account &&
      !charName &&
      !fruits &&
      !crest &&
      !guardian &&
      !updatedAt &&
      !note
    ) {
      continue;
    }

    if (rawCat) currentCategory = rawCat;

    let questNamePart = rawQuestCell;
    let detectedAttr = '';

    if (VALID_ATTRS.includes(rawQuestCell)) {
      questNamePart = '';
      detectedAttr = rawQuestCell;
    } else if (rawQuestCell.includes('\n')) {
      const lines = rawQuestCell
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length >= 2 && VALID_ATTRS.includes(lines[lines.length - 1])) {
        detectedAttr = lines.pop();
        questNamePart = lines.join(' ');
      }
    }

    // 1stの行、または新しいクエスト名が出現したら新規カードを作成
    if (slotLabel === '1st' || questNamePart !== '') {
      const questName =
        questNamePart ||
        (currentQuestObj ? currentQuestObj.questName : '名称未設定');
      currentQuestObj = {
        id: `${currentCategory}-${questName}-${i}`,
        category: currentCategory || '未分類',
        questName: questName,
        attr: detectedAttr,
        isVisible: isChecked(displayCell), // 🌟 1st行のA列のチェック状態をクエスト全体の表示設定にする
        guardian: guardian,
        updatedAt: updatedAt,
        notes: [],
        slots: [],
      };
      quests.push(currentQuestObj);
    }

    // 1クエストにつき最大4枠（1st〜4th）まで追加
    if (currentQuestObj && currentQuestObj.slots.length < 4) {
      if (detectedAttr) currentQuestObj.attr = detectedAttr;
      if (!currentQuestObj.guardian && guardian)
        currentQuestObj.guardian = guardian;
      if (!currentQuestObj.updatedAt && updatedAt)
        currentQuestObj.updatedAt = updatedAt;
      if (note) currentQuestObj.notes.push(note);

      currentQuestObj.slots.push({
        slotLabel: slotLabel || `${currentQuestObj.slots.length + 1}`,
        account,
        charName,
        fruits,
        crest,
      });
    }
  }

  // 表示対象のクエストからカテゴリ一覧を抽出
  const activeQuestsForCat = quests.filter(
    (q) => q.isVisible || showHiddenQuests
  );
  const categories = [
    'すべて',
    ...Array.from(new Set(activeQuestsForCat.map((q) => q.category))),
  ];

  const filteredQuests = quests.filter((q) => {
    // 🌟 A列（1st行）のチェックが外れているクエストは非表示にする
    if (!q.isVisible && !showHiddenQuests) return false;

    const hasAnyChar = q.slots.some((s) => s.charName !== '');
    if (hideEmptyQuests && !hasAnyChar) return false;

    if (selectedCategory !== 'すべて' && q.category !== selectedCategory)
      return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchQuest = q.questName.toLowerCase().includes(term);
      const matchCat = q.category.toLowerCase().includes(term);
      const matchChar = q.slots.some((s) =>
        s.charName.toLowerCase().includes(term)
      );
      if (!matchQuest && !matchCat && !matchChar) return false;
    }

    return true;
  });

  return (
    <div className="formation-wrapper">
      <div
        className="filter-section"
        style={{ marginBottom: '16px', padding: '12px' }}
      >
        <input
          type="text"
          className="search-input"
          style={{ marginBottom: '12px' }}
          placeholder="クエスト名・キャラ名で検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="filter-row" style={{ alignItems: 'center' }}>
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

        <div
          className="filter-row"
          style={{
            marginTop: '8px',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
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
              checked={hideEmptyQuests}
              onChange={(e) => setHideEmptyQuests(e.target.checked)}
            />
            キャラ未入力のクエストを非表示
          </label>

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
              checked={showHiddenQuests}
              onChange={(e) => setShowHiddenQuests(e.target.checked)}
            />
            非表示（チェックOFF）の編成も表示
          </label>
        </div>
      </div>

      <div className="quest-grid">
        {filteredQuests.map((quest) => {
          const attr =
            quest.attr || detectFallbackAttr(quest.questName, quest.slots);
          return (
            <div
              key={quest.id}
              className={`quest-card quest-attr-${attr}`}
              style={!quest.isVisible ? { opacity: 0.6 } : {}}
            >
              <div className="quest-card-header">
                <div className="quest-title-group">
                  <span className="quest-category-badge">{quest.category}</span>
                  <h3 className="quest-name">
                    {quest.questName}
                    {!quest.isVisible && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: '#aaa',
                          marginLeft: '8px',
                          fontWeight: 'normal',
                        }}
                      >
                        (非表示)
                      </span>
                    )}
                  </h3>
                </div>
                <div className="quest-meta-group">
                  {quest.guardian && (
                    <span className="guardian-badge">
                      守護獣: {quest.guardian}
                    </span>
                  )}
                  {quest.updatedAt && (
                    <span className="quest-date">{quest.updatedAt}</span>
                  )}
                </div>
              </div>

              <div className="quest-slots">
                {quest.slots.map((slot, idx) => (
                  <div key={idx} className="slot-row">
                    <div className="slot-left">
                      <span className="slot-number">{slot.slotLabel}</span>
                      <span
                        className={`slot-account ${
                          slot.account ? 'active' : 'empty'
                        }`}
                      >
                        {slot.account || '-'}
                      </span>
                      <span className="slot-char-name">
                        {slot.charName || (
                          <span style={{ color: '#555' }}>未設定</span>
                        )}
                      </span>
                    </div>

                    <div className="slot-right">
                      {slot.fruits && (
                        <div className="slot-tag fruits-tag">
                          <span className="tag-label">実</span>
                          {slot.fruits}
                        </div>
                      )}
                      {slot.crest && (
                        <div className="slot-tag crest-tag">
                          <span className="tag-label">紋章</span>
                          {slot.crest}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {quest.notes.length > 0 && (
                <div className="quest-note">
                  <span className="note-icon">📝</span>
                  <div className="note-lines">
                    {quest.notes.map((line, nIdx) => (
                      <div key={nIdx}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
