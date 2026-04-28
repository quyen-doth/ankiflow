// scripts/setup-anki.js
// Chạy file này bằng lệnh: node scripts/setup-anki.js

const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';

async function invoke(action, params = {}) {
  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: 6, params }),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data.result;
  } catch (error) {
    console.error(`Error invoking ${action}:`, error.message);
    throw error;
  }
}

async function setupAnki() {
  console.log('🚀 Bắt đầu cài đặt Anki Models & Decks...');

  // 1. Tạo Decks cơ bản
  const decks = [
    'Language::Chinese::HSK1',
    'Language::Japanese::N5',
    'Language::English::B1',
    'Vocabulary::IT',
    'Vocabulary::General'
  ];

  for (const deck of decks) {
    console.log(`\n📦 Đang tạo deck: ${deck}`);
    try {
      await invoke('createDeck', { deck });
      console.log(`✅ Đã tạo deck: ${deck}`);
    } catch (e) {
      console.log(`⚠️ Deck đã tồn tại hoặc lỗi: ${e.message}`);
    }
  }

  // 2. Tạo Models (Note Types)
  // CSS cơ bản từ PRD
  const css = `
.card-container {
  font-family: 'Inter', -apple-system, sans-serif;
  color: #334155;
  background-color: #ffffff;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
}
.word-main { font-size: 48px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
.reading { font-size: 24px; color: #64748b; margin-bottom: 12px; font-weight: 500; }
.meaning { font-size: 22px; color: #3b82f6; font-weight: 600; margin: 20px 0; }
.example-box { background: rgba(59, 130, 246, 0.08); padding: 16px; border-radius: 12px; margin: 16px 0; text-align: left; }
.divider { border: 0; height: 1px; background: #e2e8f0; margin: 24px 0; }
`;

  const models = [
    {
      modelName: 'AnkiFlow-Language-Chinese',
      inOrderFields: ["Word", "Pinyin", "HanViet", "MeaningVI", "WordType", "Level", "ExampleSentence", "ExampleTranslation", "ExampleBlank", "ExampleAudio", "Collocations", "Image", "Audio"],
      css: css,
      cardTemplates: [
        {
          Name: "Từ -> Nghĩa",
          Front: `<div class="card-container">\n  <div class="word-main">{{Word}}</div>\n  <div class="reading">{{Pinyin}}</div>\n  <div class="audio-section">{{Audio}}</div>\n</div>`,
          Back: `<div class="card-container">\n  <div class="word-main">{{Word}}</div>\n  <div class="reading">{{Pinyin}}</div>\n  <div class="audio-section">{{Audio}}</div>\n  <hr class="divider">\n  <div class="meaning">{{MeaningVI}}</div>\n  <div class="example-box">{{ExampleSentence}}<br>{{ExampleTranslation}}</div>\n</div>`
        }
      ]
    },
    // Thêm các models khác nếu cần...
  ];

  for (const model of models) {
    console.log(`\n📝 Đang tạo model: ${model.modelName}`);
    try {
      // AnkiConnect API for creating models
      await invoke('createModel', {
        modelName: model.modelName,
        inOrderFields: model.inOrderFields,
        css: model.css,
        isCloze: false,
        cardTemplates: model.cardTemplates
      });
      console.log(`✅ Đã tạo model: ${model.modelName}`);
    } catch (e) {
      if (e.message.includes('Model name already exists')) {
        console.log(`✅ Model ${model.modelName} đã tồn tại, tiến hành update CSS/Templates (nếu cần ở tương lai).`);
      } else {
        console.log(`❌ Lỗi khi tạo model: ${e.message}`);
      }
    }
  }

  console.log('\n🎉 Hoàn thành cài đặt Anki!');
}

setupAnki().catch(console.error);
