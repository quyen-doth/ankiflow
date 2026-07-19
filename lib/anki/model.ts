export const ANKI_MODEL_NAME = 'AnkiFlow-Basic'

export const ANKI_MODEL_FIELDS = ['Front', 'Back']

export const ANKI_CARD_TEMPLATES = [
  {
    Name: 'Card 1',
    Front: '{{Front}}',
    Back: '{{FrontSide}}<hr id="answer">{{Back}}',
  },
]

export const ANKI_CARD_CSS = `
.card {
  font-family: 'Inter', -apple-system, 'Noto Sans SC', 'Noto Sans JP', sans-serif;
  font-size: 18px;
  text-align: center;
  color: #15171C;
  background-color: #ffffff;
  max-width: 560px;
  margin: 0 auto;
  padding: 28px;
  line-height: 1.5;
}

.front,
.back {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.word {
  font-size: 34px;
  font-weight: 800;
  color: #15171C;
  letter-spacing: -0.02em;
}

.reading {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 14px;
  color: #9396A0;
  letter-spacing: 0.05em;
}

.han-viet {
  font-size: 13px;
  font-weight: 700;
  color: #B87514;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.pos {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: 20px;
  background: #FAF3E6;
  color: #B87514;
}

.meaning {
  font-size: 20px;
  color: #15171C;
}

.example {
  text-align: left;
  font-size: 15px;
  line-height: 1.6;
  color: #3D4048;
  font-style: italic;
  max-width: 480px;
}

.example b,
.example .cloze {
  font-weight: 800;
  color: #316342;
  font-style: normal;
}

.translation {
  font-size: 13px;
  color: #5C606A;
  font-style: italic;
}

.custom-field {
  white-space: pre-line;
}

.collocations {
  text-align: left;
  font-size: 14px;
  color: #3D4048;
  list-style: none;
  padding: 0;
  margin: 0;
}

.collocations li::before {
  content: '\\2022  ';
  color: #9396A0;
}

.media img {
  max-height: 220px;
  border-radius: 10px;
  margin: 0 auto;
  display: block;
  object-fit: contain;
}

hr#answer {
  border: 0;
  height: 1px;
  background: #E8E8E3;
  margin: 20px 0;
}

.nightMode .card {
  color: #E8E8E3;
  background-color: #1A1B1E;
}

.nightMode .word { color: #E8E8E3; }
.nightMode .han-viet { color: #D4A054; }
.nightMode .meaning { color: #E8E8E3; }
.nightMode .example { color: #B4B6BE; }
.nightMode .translation { color: #7C8090; }
.nightMode .collocations { color: #B4B6BE; }
.nightMode .pos { background: #2A2C30; color: #D4A054; }
.nightMode hr#answer { background: #2A2C30; }
`
