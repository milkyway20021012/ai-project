import React, { useState } from 'react';
import './GameStart.css';

const GameStart = ({ onStartGame }) => {
    const [playerOrder, setPlayerOrder] = useState('first'); // 'first' 或 'second'
    const [gameMode, setGameMode] = useState('ai'); // 'ai' 或 'player'
    const [showRules, setShowRules] = useState(false);

    const handleStartGame = () => {
        onStartGame({
            playerIsFirst: playerOrder === 'first',
            againstAI: gameMode === 'ai'
        });
    };

    return (
        <div className="game-start-container">
            <div className="game-start-card">
                <h1 className="game-start-title">黑白棋</h1>

                <div className="start-section">
                    <h2 className="section-title">選擇模式</h2>
                    <div className="option-buttons">
                        <button
                            className={`option-button ${gameMode === 'ai' ? 'selected' : ''}`}
                            onClick={() => setGameMode('ai')}
                        >
                            <div className="option-icon">🤖</div>
                            <span>玩家 vs. 電腦</span>
                        </button>
                        <button
                            className={`option-button ${gameMode === 'player' ? 'selected' : ''}`}
                            onClick={() => setGameMode('player')}
                        >
                            <div className="option-icon">👥</div>
                            <span>玩家 vs. 玩家</span>
                        </button>
                    </div>
                </div>

                <div className="start-section">
                    <h2 className="section-title">
                        {gameMode === 'ai' ? '選擇先後手' : '黑棋先手'}
                    </h2>
                    <div className="option-buttons">
                        <button
                            className={`option-button ${playerOrder === 'first' ? 'selected' : ''}`}
                            onClick={() => setPlayerOrder('first')}
                            disabled={gameMode === 'player'}
                        >
                            <div className="option-piece piece-black"></div>
                            <span>{gameMode === 'ai' ? '玩家執黑先手' : '玩家1執黑先手'}</span>
                        </button>
                        <button
                            className={`option-button ${playerOrder === 'second' ? 'selected' : ''}`}
                            onClick={() => setPlayerOrder('second')}
                            disabled={gameMode === 'player'}
                        >
                            <div className="option-piece piece-white"></div>
                            <span>{gameMode === 'ai' ? '電腦執黑先手' : '玩家2執白後手'}</span>
                        </button>
                    </div>
                </div>

                <div className="start-actions">
                    <button className="rules-button" onClick={() => setShowRules(!showRules)}>
                        {showRules ? '隱藏規則' : '顯示規則'}
                    </button>
                    <button className="start-button" onClick={handleStartGame}>
                        開始遊戲
                    </button>
                </div>

                {showRules && (
                    <div className="rules-container">
                        <h2 className="section-title">遊戲規則</h2>
                        <ul className="rules-list">
                            <li>黑方先落子，白方後落子</li>
                            <li>落子需要能夠夾殺對方棋子</li>
                            <li>當無法夾殺對方時可以PASS</li>
                            <li>如果吃掉對方2子以上，則必須返還其中一子</li>
                            <li>連續PASS兩次遊戲結束</li>
                            <li>計時器60秒，時間到當前玩家輸</li>
                            <li>棋子多的一方獲勝</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameStart;