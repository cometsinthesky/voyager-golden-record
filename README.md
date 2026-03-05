# Voyager Golden Record Decoder 🌌📻🛰️
> Decoder em **JavaScript (Web Audio + Canvas)** para reconstruir imagens do **Voyager Golden Record** a partir do áudio digitalizado (MP3/PCM).

**Demo (GitHub Pages):** https://maltegruber.github.io/voyager-record-decoder  
> Importante: configure sua saída de áudio em **44.1 kHz**. Em outras taxas, o “lock” pode falhar e as imagens podem aparecer instáveis.

---

## ✨ O que este repositório faz
Este projeto:
- baixa (ou carrega) o áudio do Golden Record (MP3),
- converte para **PCM float** (canais **L/R**),
- detecta pulsos de **sync**,
- reconstrói as **linhas** de imagem e desenha no **Canvas**.

---

## ✅ Melhorias e modificações (versão modernizada)
Além de manter o decoder, a versão atual inclui:

### UI / Página (layout moderno)
- Layout responsivo (desktop/tablet/mobile)
- Seções claras: Decoder, Preview, Controles e Explicação técnica
- Visual “card-based”, com foco em usabilidade e leitura

### Qualidade da imagem (melhor leitura)
- Controles de **contraste** e **gamma**
- **Suavização** (filtro leve) para reduzir ruído sem “lavar” demais a imagem
- Ajuste para estabilizar intensidade (reduz os “saltos” quando há variação abrupta)

### Direita → esquerda (efeito solicitado)
- A imagem pode ser renderizada **da direita para a esquerda** (toggle):
  - útil para comparar com referências históricas,
  - e para melhorar a interpretação visual dependendo do “lock” e do sinal.

> Nota: o modo “Direita → esquerda” pode ser aplicado:
> 1) como **espelhamento de visualização** (mais simples e robusto), ou  
> 2) invertendo a **ordem real de desenho** por linha/pixel (mais “fiel” ao pipeline).  
> A implementação do repositório pode usar qualquer uma das duas abordagens.

---

## 🚀 Como usar (rápido)
1. Abra a página do projeto (Demo) ou rode localmente.
2. Garanta **44.1 kHz** na configuração de áudio do sistema.
3. Inicie o decoding e aguarde o “lock”.
4. Ajuste:
   - **Contraste** (1.2–1.8 costuma ajudar)
   - **Gamma** (0.8–1.1 é um bom intervalo)
   - **Suavização** (1–3 para reduzir ruído)
5. Ative **Direita → esquerda** para inverter a direção de preenchimento.

---

## 🧠 Como funciona (visão técnica)

### Pipeline
1. **Download / carregamento do áudio**
2. **Decodificação para PCM**
3. Separação dos canais **Left/Right**
4. Varredura de **sync pulses**
5. Reconstrução linha-a-linha e renderização no **Canvas**

### Detecção de Sync (heurística simples)
O método atual é propositalmente “cru”:
- varre o array do canal em busca de picos
- identifica sync quando um pulso é maior que a vizinhança local  

Funciona “na maioria das vezes”, mas sofre com artefatos do arquivo digitalizado.

---

## ⚠️ Artefatos do áudio (filtro / DC-pull)
Durante a digitalização, o áudio aparenta ter passado por algum filtro (provável **DC-blocking / high-pass**). Isso causa:

- tendência do sinal a “voltar para zero” em trechos com pouca variação,
- “puxões” do nível DC após mudanças bruscas,
- distorções visíveis na imagem reconstruída (skew/arrasto).

### Ilustração (high-pass / DC-pull)
![High pass filtering illustration](/doc/voyager-lp.png)

### Efeito na imagem
![High pass filtering effects on image](/doc/numbers.png)

**Hipóteses levantadas:**
- filtro de bloqueio DC do gravador durante a digitalização
- possível influência de **RIAA filtering**
- ou algum detalhe do processo de codificação

Esse comportamento já foi observado por outras pessoas também (exemplo clássico: Boing Boing).

---

## 🎨 RGB Images (limitação conhecida)
O Voyager Golden Record contém imagens **RGB** armazenadas como **três imagens separadas** (um canal por vez).  
**Este decoder não combina automaticamente** esses três frames em uma imagem RGB final.

> Roadmap sugerido:
> - detectar sequências R/G/B,
> - alinhar temporalmente as três camadas,
> - combinar em uma imagem composta.

---

## 🧩 Controles recomendados (dicas práticas)

Se a imagem estiver “apagada”:
- aumente **Contraste**
- reduza um pouco o **Gamma**

Se a imagem estiver “chuviscada”:
- aumente **Suavização** (com moderação)

Se parecer “invertida”/estranha:
- ative **Direita → esquerda**
- teste também a troca de canal (L vs R), dependendo do material de origem

---

## 🛠️ Rodar localmente
Por causa do Web Audio e de políticas de CORS, é melhor usar um servidor local:

### Opção 1: VS Code Live Server
- instale a extensão **Live Server**
- clique em “Go Live”

### Opção 2: Python (rápido)
```bash
python -m http.server 8000

---

## 📁 Estrutura típica do projeto

Uma estrutura comum (pode variar conforme seu fork):

- `index.html` — página principal (UI + canvas)
- `styles.css` — estilos e responsividade
- `js/`
  - `decoder.js` — pipeline principal (**PCM → sync → linhas → render**)
  - `audio.js` — carregamento/decodificação do áudio
  - `render.js` — desenho no canvas (imagem, waveform, overlays)
  - `utils.js` — helpers (normalização, LUT, filtros, etc.)
- `assets/` — ícones, imagens de UI, arquivos auxiliares
- `doc/` — documentação e figuras técnicas (ex.: `voyager-lp.png`, `numbers.png`)
- `README.md` — este arquivo
- `LICENSE` — licença do repositório

---

## 🧾 Créditos / Referências

### Projeto e implementação
- **Malte Gruber** — implementação original do decoder e publicação da demo em GitHub Pages.

### Contexto e material histórico
- **NASA/JPL – Voyager Golden Record** — contexto, missão e acervo histórico/cultural.

### Discussões e leituras relacionadas
Decodificação de imagens do Voyager Golden Record e artefatos do áudio digitalizado:

- **Boing Boing (2017)** — *“How to decode the images on the Voyager Golden Record”* (post/relato popular citado no README original).

---

## ℹ️ Observação

Este projeto é **educativo/experimental**. A qualidade do resultado depende fortemente do **material de áudio disponível** e do **processamento aplicado** durante a digitalização.
