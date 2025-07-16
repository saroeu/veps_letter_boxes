document.addEventListener('DOMContentLoaded', () => {
    // Инициализация игры
    console.log('Letter Boxed Game Initializing...');

    // Получаем данные доски
    const boardData = JSON.parse(document.getElementById('board-data').textContent);
    console.log('Board data loaded:', boardData);

    // Нормализуем данные доски (поддержка старого и нового формата)
    const board = boardData.map(side => side.map(letter => {
        return typeof letter === 'object' ? letter.char : letter;
    }));
    console.log('Normalized board:', board);

    // Состояние игры
    const gameState = {
        selectedLetters: [],    // {letter, side, element}
        usedWords: [],
        usedLetters: new Set(), // Все использованные буквы
        lastLetter: null,       // Последняя буква предыдущего слова
        locked: false           // Блокировка во время анимаций
    };

    // DOM элементы
    const elements = {
        currentWord: document.getElementById('current-word'),
        messageBox: document.getElementById('message-box'),
        wordCount: document.getElementById('word-count'),
        lettersCount: document.getElementById('letters-count'),
        usedWords: document.getElementById('used-words'),
        submitBtn: document.getElementById('submit-word'),
        deleteBtn: document.getElementById('delete-btn'),
        shuffleBtn: document.getElementById('shuffle-btn'),
        letterElements: Array.from(document.querySelectorAll('.letter'))
    };

    // Инициализация букв
    function initializeLetters() {
        elements.letterElements.forEach((el, index) => {
            const sideIdx = Math.floor(index / 3);
            const letterIdx = index % 3;
            const letter = board[sideIdx][letterIdx];

            el.dataset.letter = letter;
            el.dataset.side = sideIdx;
            el.textContent = letter;
            el.classList.remove('selected', 'disabled');

            el.addEventListener('click', () => !gameState.locked && handleLetterClick(el));
        });
    }

    // Обработчик клика по букве
    function handleLetterClick(letterEl) {
        const letter = letterEl.dataset.letter;
        const side = parseInt(letterEl.dataset.side);

        // Если буква уже выбрана
        const existingIndex = gameState.selectedLetters.findIndex(
            l => l.element === letterEl
        );

        if (existingIndex >= 0) {
            unselectLetter(existingIndex);
            return;
        }

        // Проверка правил игры
        if (gameState.selectedLetters.length > 0) {
            const lastSelected = gameState.selectedLetters[gameState.selectedLetters.length - 1];

            // Проверка стороны
            if (lastSelected.side === side) {
                showMessage('Буквы должны быть с разных сторон!', 'error');
                return;
            }

            // Проверка повторной буквы
            if (lastSelected.letter === letter) {
                showMessage('Нельзя выбирать ту же букву подряд!', 'error');
                return;
            }
        }

        selectLetter(letterEl, letter, side);
    }

    function selectLetter(letterEl, letter, side) {
        letterEl.classList.add('selected');
        gameState.selectedLetters.push({ letter, side, element: letterEl });
        updateCurrentWord();
    }

    function unselectLetter(index) {
        const { element } = gameState.selectedLetters[index];
        element.classList.remove('selected');
        gameState.selectedLetters.splice(index, 1);
        updateCurrentWord();
    }

    function updateCurrentWord() {
        elements.currentWord.textContent = gameState.selectedLetters
            .map(item => item.letter)
            .join(' ');
    }

    // Отправка слова на проверку
    async function submitWord() {
        if (gameState.locked) return;

        const word = gameState.selectedLetters.map(l => l.letter).join('');

        if (word.length < 3) {
            showMessage('Минимум 3 буквы!', 'error');
            return;
        }

        gameState.locked = true;

        try {
            const response = await fetch('/check_word', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    word,
                    board,
                    last_letter: gameState.lastLetter
                })
            });

            const result = await response.json();

            if (result.valid) {
                await processValidWord(word, result.last_letter);
            } else {
                showMessage(result.message, 'error');
                await highlightError();
            }
        } catch (error) {
            console.error('Submission error:', error);
            showMessage('Ошибка соединения', 'error');
        } finally {
            gameState.locked = false;
        }
    }

    async function processValidWord(word, lastLetter) {
        // Добавляем слово в историю
        gameState.usedWords.push(word);
        gameState.lastLetter = lastLetter;

        // Добавляем буквы в использованные
        word.split('').forEach(l => gameState.usedLetters.add(l));

        // Показываем успех
        showMessage('✓ Слово принято!', 'success');

        // Сбрасываем выделение
        resetSelection();

        // Обновляем статистику
        updateStats();

        // Проверяем победу
        if (gameState.usedLetters.size === 9) {
            await showWinMessage();
        }
    }

    function resetSelection() {
        gameState.selectedLetters.forEach(({ element }) => {
            element.classList.remove('selected');
        });
        gameState.selectedLetters = [];
        elements.currentWord.textContent = '';
    }

    function updateStats() {
        elements.wordCount.textContent = gameState.usedWords.length;
        elements.lettersCount.textContent = gameState.usedLetters.size;
        elements.usedWords.textContent = gameState.usedWords.join(', ');
    }

    // Удаление последней буквы
    function deleteLastLetter() {
        if (gameState.locked || gameState.selectedLetters.length === 0) return;
        unselectLetter(gameState.selectedLetters.length - 1);
    }

    // Перемешивание букв
    function shuffleLetters() {
        if (gameState.locked) return;

        gameState.locked = true;

        // Собираем все буквы
        const allLetters = board.flat();

        // Перемешиваем
        for (let i = allLetters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allLetters[i], allLetters[j]] = [allLetters[j], allLetters[i]];
        }

        // Обновляем доску
        let index = 0;
        board.forEach((side, sideIdx) => {
            side.forEach((_, letterIdx) => {
                board[sideIdx][letterIdx] = allLetters[index++];
            });
        });

        // Обновляем DOM
        initializeLetters();
        resetSelection();

        gameState.locked = false;
        console.log('Letters shuffled:', board);
    }

    // Вспомогательные функции UI
    function showMessage(text, type) {
        elements.messageBox.textContent = text;
        elements.messageBox.className = `message ${type}`;

        if (type === 'error') {
            setTimeout(() => {
                elements.messageBox.textContent = '';
                elements.messageBox.className = 'message';
            }, 3000);
        }
    }

    async function highlightError() {
        elements.currentWord.classList.add('error');
        await new Promise(resolve => setTimeout(resolve, 500));
        elements.currentWord.classList.remove('error');
    }

    async function showWinMessage() {
        await new Promise(resolve => setTimeout(resolve, 500));
        showMessage(`🎉 Победа! Слов: ${gameState.usedWords.length}`, 'success');
    }

    // Инициализация игры
    initializeLetters();

    // Назначаем обработчики кнопок
    elements.submitBtn.addEventListener('click', submitWord);
    elements.deleteBtn.addEventListener('click', deleteLastLetter);
    elements.shuffleBtn.addEventListener('click', shuffleLetters);

    console.log('Game initialized successfully');
});