from flask import Flask, render_template, request, jsonify
import random
from collections import defaultdict
import os

app = Flask(__name__)

# Конфигурация игры
VOWELS = ['A', 'E', 'I', 'O', 'U', 'Ä', 'Ö', 'Ü']
CONSONANTS = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N',
              'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z', 'Č', 'Ž', 'Š']
MIN_WORD_LENGTH = 3
MAX_GENERATION_ATTEMPTS = 100
REQUIRED_LETTERS_COUNT = 9

# Глобальная переменная для хранения последней цепочки слов
last_word_chain = []


def load_dictionary():
    """Загружает словарь из файла"""
    with open('words.txt', 'r', encoding='utf-8') as f:
        words = [line.strip().upper() for line in f if line.strip()]
        return [word for word in words if len(word) >= MIN_WORD_LENGTH and all(c in VOWELS + CONSONANTS for c in word)]


def find_word_chain(dictionary):
    """Находит подходящую цепочку слов"""
    # Создаем индекс: первая буква -> список слов
    word_index = defaultdict(list)
    for word in dictionary:
        word_index[word[0]].append(word)

    for _ in range(MAX_GENERATION_ATTEMPTS):
        # Выбираем случайное начальное слово
        first_word = random.choice(dictionary)
        chain = [first_word]
        unique_letters = set(first_word)

        # Пытаемся расширить цепочку
        while len(chain) < 3 and len(unique_letters) < REQUIRED_LETTERS_COUNT:
            last_letter = chain[-1][-1]
            candidates = [w for w in word_index.get(last_letter, [])
                          if len(set(w) - unique_letters) > 0]

            if not candidates:
                break

            next_word = random.choice(candidates)
            chain.append(next_word)
            unique_letters.update(next_word)

        # Проверяем, подходит ли цепочка
        if len(unique_letters) == REQUIRED_LETTERS_COUNT and 1 <= len(chain) <= 3:
            return chain, unique_letters

    return None, None


def generate_solvable_board():
    """Генерирует доску с гарантированным решением (только из валидных цепочек слов)"""
    global last_word_chain
    dictionary = load_dictionary()

    # Будем пытаться найти цепочку слов, пока не получим валидную
    while True:
        word_chain, letters = find_word_chain(dictionary)
        if word_chain:
            last_word_chain = word_chain
            app.logger.info(f"\nИспользованная цепочка слов: {' → '.join(word_chain)}")
            letters = list(letters)

            # Формируем доску
            random.shuffle(letters)
            board = [
                letters[0:3],
                letters[3:6],
                letters[6:9],
                [letters[-1]] + letters[0:2]  # Замыкаем круг
            ]

            app.logger.info(f"Сгенерированная доска: {board}")
            return board

        app.logger.info("Пытаемся найти другую цепочку слов...")


@app.route('/')
def home():
    """Главная страница"""
    board = generate_solvable_board()
    return render_template('index.html', board=board)


@app.route('/check_word', methods=['POST'])
def check_word():
    """Проверяет слово на соответствие правилам"""
    data = request.get_json()
    word = data["word"].upper().strip()
    board = data["board"]
    last_letter = data.get("last_letter")
    # Проверка минимальной длины
    if len(word) < MIN_WORD_LENGTH:
        return jsonify({
            "valid": False,
            "message": f"Слово должно содержать минимум {MIN_WORD_LENGTH} буквы"
        })

    # Проверка использования только букв с доски
    board_letters = set(letter for side in board for letter in side)
    invalid_letters = set(word) - board_letters
    if invalid_letters:
        return jsonify({
            "valid": False,
            "message": f"Использованы недопустимые буквы: {', '.join(invalid_letters)}"
        })

    # Проверка связи с предыдущим словом
    if last_letter and word[0] != last_letter:
        return jsonify({
            "valid": False,
            "message": f"Слово должно начинаться на '{last_letter}'"
        })

    # Проверка наличия слова в словаре
    dictionary = load_dictionary()
    if word not in dictionary:
        return jsonify({
            "valid": False,
            "message": f"Слово '{word}' не найдено в словаре"
        })

    return jsonify({
        "valid": True,
        "message": "✓ Слово принято!",
        "last_letter": word[-1]
    })


if __name__ == '__main__':
    print("Запуск игры Letter Boxed...")
    print(f"Используемые гласные: {VOWELS}")
    print(f"Используемые согласные: {CONSONANTS}")

    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
