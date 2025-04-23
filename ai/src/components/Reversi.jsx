import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Reversi.css';
import GameStart from './GameStart';


const Reversi = () => {
    // 新增遊戲狀態
    const [gameStarted, setGameStarted] = useState(false);
    const [gameOptions, setGameOptions] = useState({
        playerIsFirst: true,
        againstAI: true
    });
    const [isReturningPiece, setIsReturningPiece] = useState(false);
    // 添加新的狀態變量跟踪最近一次操作是否是返還
    const [lastMoveWasReturn, setLastMoveWasReturn] = useState(false);

    // 棋盤大小
    const BOARD_SIZE = 8;

    // 玩家定義
    const PLAYER = {
        EMPTY: null,
        X: 'X',  // 黑色
        O: 'O'   // 白色
    };

    // 初始棋盤狀態
    const initialBoard = () => {
        const board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(PLAYER.EMPTY));
        // 設置初始棋子位置
        board[3][3] = PLAYER.O;
        board[3][4] = PLAYER.X;
        board[4][3] = PLAYER.X;
        board[4][4] = PLAYER.O;
        return board;
    };

    // 其他状态变量...
    const [board, setBoard] = useState(initialBoard());
    const [currentPlayer, setCurrentPlayer] = useState(PLAYER.X);
    const [gameStatus, setGameStatus] = useState('正在進行中');
    const [validMoves, setValidMoves] = useState([]);
    const [gameHistory, setGameHistory] = useState([]);
    const [capturedPositions, setCapturedPositions] = useState([]);
    const [needReturn, setNeedReturn] = useState(false);
    const [timer, setTimer] = useState(60);
    const [gameOver, setGameOver] = useState(false);
    const [playerIsX, setPlayerIsX] = useState(true);
    const [returnedPiece, setReturnedPiece] = useState(null);
    const timerRef = useRef(null);
    const aiTimeoutRef = useRef(null);
    // 追踪 AI 是否正在行動，避免重複觸發
    const isAIMoving = useRef(false);

    // 位置權重矩陣 - 用於AI評估
    const positionWeights = [
        [120, -20, 20, 5, 5, 20, -20, 120],
        [-20, -40, -5, -5, -5, -5, -40, -20],
        [20, -5, 15, 3, 3, 15, -5, 20],
        [5, -5, 3, 3, 3, 3, -5, 5],
        [5, -5, 3, 3, 3, 3, -5, 5],
        [20, -5, 15, 3, 3, 15, -5, 20],
        [-20, -40, -5, -5, -5, -5, -40, -20],
        [120, -20, 20, 5, 5, 20, -20, 120]
    ];

    // 方向
    const DIRECTIONS = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];
    // 處理遊戲開始
    const handleGameStart = (options) => {
        console.log("處理遊戲開始", options);
        setGameOptions(options);
        setPlayerIsX(options.playerIsFirst);
        setGameStarted(true);

        // 使用setTimeout確保狀態更新完成
        setTimeout(() => {
            console.log("開始遊戲設置完成，準備重啟遊戲", {
                玩家先手: options.playerIsFirst,
                對戰AI: options.againstAI
            });
            restartGame(options.playerIsFirst, options.againstAI);
        }, 200); // 稍微增加延遲
    };

    // 返回開始界面
    const returnToStart = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        if (aiTimeoutRef.current) {
            clearTimeout(aiTimeoutRef.current);
        }
        setGameStarted(false);
    };

    // 檢查是否在棋盤內
    const isValidPosition = (row, col) => {
        return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
    };

    // 檢查是否可以在特定方向夾殺對方棋子
    const canFlipInDirection = (row, col, dr, dc, player, boardState = board) => {
        const opponent = player === PLAYER.X ? PLAYER.O : PLAYER.X;
        let r = row + dr;
        let c = col + dc;
        let flippable = [];

        // 檢查這個方向是否有對方的棋子
        while (isValidPosition(r, c) && boardState[r][c] === opponent) {
            flippable.push([r, c]);
            r += dr;
            c += dc;
        }

        // 如果這個方向的最後一個位置是自己的棋子，那麼這個方向是可以夾殺的
        return flippable.length > 0 && isValidPosition(r, c) && boardState[r][c] === player ? flippable : [];
    };

    // 檢查是否可以在此位置落子
    const isValidMove = (row, col, player, boardState = board) => {
        // 位置必須為空
        if (boardState[row][col] !== PLAYER.EMPTY) return false;

        // 檢查所有方向是否有夾殺
        let canFlip = false;
        let allFlippable = [];

        for (const [dr, dc] of DIRECTIONS) {
            const flippable = canFlipInDirection(row, col, dr, dc, player, boardState);
            if (flippable.length > 0) {
                canFlip = true;
                allFlippable = [...allFlippable, ...flippable];
            }
        }

        return canFlip ? allFlippable : false;
    };

    // 尋找所有有效的落子位置
    const findValidMoves = useCallback((player, boardState = board) => {
        const moves = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const flippable = isValidMove(row, col, player, boardState);
                if (flippable) {
                    moves.push({ row, col, flippable });
                }
            }
        }
        return moves;
    }, [board]);

    // 重置計時器
    const resetTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        setTimer(60);

        timerRef.current = setInterval(() => {
            setTimer(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    // 時間到，目前玩家輸了
                    const winner = currentPlayer === PLAYER.X ? PLAYER.O : PLAYER.X;
                    endGame(winner, '時間到');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [currentPlayer]);
    // 結束遊戲
    const endGame = useCallback((winner = null, reason = '') => {
        if (gameOver) return;

        console.log("遊戲結束觸發，計算結果");

        // 計算棋子數量
        let xCount = 0;
        let oCount = 0;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row][col] === PLAYER.X) {
                    xCount++;
                } else if (board[row][col] === PLAYER.O) {
                    oCount++;
                }
            }
        }

        // 設置遊戲結果
        let result;

        if (gameOptions.againstAI) {
            // AI 對戰模式
            if (winner) {
                if (playerIsX) {
                    result = winner === PLAYER.X
                        ? `遊戲結束！玩家(黑)獲勝 (${reason}) (${xCount}:${oCount})`
                        : `遊戲結束！電腦(白)獲勝 (${reason}) (${oCount}:${xCount})`;
                } else {
                    result = winner === PLAYER.O
                        ? `遊戲結束！玩家(白)獲勝 (${reason}) (${oCount}:${xCount})`
                        : `遊戲結束！電腦(黑)獲勝 (${reason}) (${xCount}:${oCount})`;
                }
            } else if (xCount > oCount) {
                result = playerIsX
                    ? `遊戲結束！玩家(黑)獲勝 (${xCount}:${oCount})`
                    : `遊戲結束！電腦(黑)獲勝 (${xCount}:${oCount})`;
            } else if (oCount > xCount) {
                result = playerIsX
                    ? `遊戲結束！電腦(白)獲勝 (${oCount}:${xCount})`
                    : `遊戲結束！玩家(白)獲勝 (${oCount}:${xCount})`;
            } else {
                result = `遊戲結束！平局 (${xCount}:${oCount})`;
            }
        } else {
            // 玩家對玩家模式
            if (winner) {
                result = winner === PLAYER.X
                    ? `遊戲結束！玩家1(黑)獲勝 (${reason}) (${xCount}:${oCount})`
                    : `遊戲結束！玩家2(白)獲勝 (${reason}) (${oCount}:${xCount})`;
            } else if (xCount > oCount) {
                result = `遊戲結束！玩家1(黑)獲勝 (${xCount}:${oCount})`;
            } else if (oCount > xCount) {
                result = `遊戲結束！玩家2(白)獲勝 (${oCount}:${xCount})`;
            } else {
                result = `遊戲結束！平局 (${xCount}:${oCount})`;
            }
        }

        console.log("遊戲結果:", result);
        setGameStatus(result);
        setGameOver(true);

        // 確保清理所有計時器
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (aiTimeoutRef.current) {
            clearTimeout(aiTimeoutRef.current);
            aiTimeoutRef.current = null;
        }

        // 添加一個警告框顯示結果
        setTimeout(() => {
            alert(result);
        }, 500);

    }, [board, gameOver, playerIsX, gameOptions]);

    // AI策略 - 評估棋局
    const evaluateBoard = (boardState, player) => {
        const opponent = player === PLAYER.X ? PLAYER.O : PLAYER.X;

        // 基本位置分數
        let positionScore = 0;
        // 行動力分數（可移動的位置數量）
        let mobilityScore = 0;
        // 穩定子分數（不可被翻轉的棋子）
        let stabilityScore = 0;
        // 棋子數量差異分數
        let pieceScore = 0;

        // 計算位置分數和棋子數量
        let playerCount = 0;
        let opponentCount = 0;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (boardState[row][col] === player) {
                    positionScore += positionWeights[row][col];
                    playerCount++;
                } else if (boardState[row][col] === opponent) {
                    positionScore -= positionWeights[row][col];
                    opponentCount++;
                }
            }
        }

        // 計算行動力分數 - 可移動位置的數量
        const playerMoves = findValidMoves(player, boardState).length;
        const opponentMoves = findValidMoves(opponent, boardState).length;
        mobilityScore = (playerMoves - opponentMoves) * 10;

        // 計算穩定子 - 角落和已經完全填滿的邊
        const corners = [
            [0, 0], [0, BOARD_SIZE - 1],
            [BOARD_SIZE - 1, 0], [BOARD_SIZE - 1, BOARD_SIZE - 1]
        ];

        // 角落棋子計算
        for (const [row, col] of corners) {
            if (boardState[row][col] === player) {
                stabilityScore += 25;
            } else if (boardState[row][col] === opponent) {
                stabilityScore -= 25;
            }
        }

        // 棋子數量差異分數 - 根據遊戲階段調整權重
        const totalPieces = playerCount + opponentCount;
        const maxPieces = BOARD_SIZE * BOARD_SIZE;
        const gameProgress = totalPieces / maxPieces;

        // 遊戲前期重視位置，中期重視行動力，後期重視數量
        if (gameProgress < 0.3) {
            // 前期 - 控制好的位置，保持行動力
            pieceScore = (playerCount - opponentCount) * 1;
            return positionScore * 3 + mobilityScore * 2 + stabilityScore * 3 + pieceScore;
        } else if (gameProgress < 0.7) {
            // 中期 - 行動力和穩定子很重要
            pieceScore = (playerCount - opponentCount) * 2;
            return positionScore * 2 + mobilityScore * 3 + stabilityScore * 3 + pieceScore;
        } else {
            // 後期 - 重視棋子數量
            pieceScore = (playerCount - opponentCount) * 5;
            return positionScore * 1 + mobilityScore * 1 + stabilityScore * 2 + pieceScore;
        }
    };
    // 極大極小算法 (Minimax) 帶有 Alpha-Beta 剪枝
    const minimax = (boardState, depth, alpha, beta, isMaximizingPlayer, player) => {
        const opponent = player === PLAYER.X ? PLAYER.O : PLAYER.X;

        // 達到搜索深度或遊戲結束
        if (depth === 0) {
            return evaluateBoard(boardState, player);
        }

        // 獲取當前玩家的有效移動
        const currentPlayer = isMaximizingPlayer ? player : opponent;
        const validMoves = findValidMoves(currentPlayer, boardState);

        // 如果當前玩家沒有有效移動
        if (validMoves.length === 0) {
            // 檢查對手是否也沒有有效移動
            const opponentMoves = findValidMoves(isMaximizingPlayer ? opponent : player, boardState);
            if (opponentMoves.length === 0) {
                // 遊戲結束，計算最終分數
                let playerCount = 0;
                let opponentCount = 0;

                for (let row = 0; row < BOARD_SIZE; row++) {
                    for (let col = 0; col < BOARD_SIZE; col++) {
                        if (boardState[row][col] === player) {
                            playerCount++;
                        } else if (boardState[row][col] === opponent) {
                            opponentCount++;
                        }
                    }
                }

                return playerCount > opponentCount ? 1000 : (playerCount < opponentCount ? -1000 : 0);
            }

            // 如果當前玩家沒有有效移動但對手有，則跳過當前玩家
            return minimax(boardState, depth - 1, alpha, beta, !isMaximizingPlayer, player);
        }

        if (isMaximizingPlayer) {
            let maxEval = -Infinity;

            for (const move of validMoves) {
                // 模擬此落子
                const newBoard = boardState.map(row => [...row]);
                newBoard[move.row][move.col] = player;

                // 翻轉被夾殺的子
                for (const [r, c] of move.flippable) {
                    newBoard[r][c] = player;
                }

                // 如果吃掉2子以上，需要返還（模擬最佳情況）
                if (move.flippable.length >= 2) {
                    // 尋找價值最低的子返還
                    let lowestValue = Infinity;
                    let lowestPos = null;

                    for (const [r, c] of move.flippable) {
                        const value = positionWeights[r][c];
                        if (value < lowestValue) {
                            lowestValue = value;
                            lowestPos = [r, c];
                        }
                    }

                    if (lowestPos) {
                        newBoard[lowestPos[0]][lowestPos[1]] = opponent;
                    }
                }

                const evalScore = minimax(newBoard, depth - 1, alpha, beta, false, player);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);

                if (beta <= alpha) {
                    break; // Beta 剪枝
                }
            }

            return maxEval;
        } else {
            let minEval = Infinity;

            for (const move of validMoves) {
                // 模擬此落子
                const newBoard = boardState.map(row => [...row]);
                newBoard[move.row][move.col] = opponent;

                // 翻轉被夾殺的子
                for (const [r, c] of move.flippable) {
                    newBoard[r][c] = opponent;
                }

                // 如果吃掉2子以上，需要返還（模擬最佳情況）
                if (move.flippable.length >= 2) {
                    // 尋找價值最低的子返還
                    let lowestValue = Infinity;
                    let lowestPos = null;

                    for (const [r, c] of move.flippable) {
                        const value = positionWeights[r][c];
                        if (value < lowestValue) {
                            lowestValue = value;
                            lowestPos = [r, c];
                        }
                    }

                    if (lowestPos) {
                        newBoard[lowestPos[0]][lowestPos[1]] = player;
                    }
                }

                const evalScore = minimax(newBoard, depth - 1, alpha, beta, true, player);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);

                if (beta <= alpha) {
                    break; // Alpha 剪枝
                }
            }

            return minEval;
        }
    };

    // 返還一子 (玩家選擇) - 修改後的版本
    const returnPiece = (row, col) => {
        if (!needReturn) return;

        // 設置返還標記
        setIsReturningPiece(true);

        // 檢查當前是哪個玩家需要返還
        let returnPlayer;
        let opponent;

        if (gameOptions.againstAI) {
            returnPlayer = playerIsX ? PLAYER.X : PLAYER.O;
            opponent = returnPlayer === PLAYER.X ? PLAYER.O : PLAYER.X;

            if (currentPlayer !== returnPlayer) {
                setIsReturningPiece(false);
                return;
            }
        } else {
            returnPlayer = currentPlayer;
            opponent = returnPlayer === PLAYER.X ? PLAYER.O : PLAYER.X;
        }

        // 確認位置是否在被捕獲的列表中
        const isInCaptured = capturedPositions.some(([r, c]) => r === row && c === col);
        if (!isInCaptured) {
            setIsReturningPiece(false);
            return;
        }

        // 創建新的棋盤狀態
        const newBoard = board.map(r => [...r]);

        // 關鍵修改：只改變這一個棋子的顏色，不做任何夾殺檢查
        newBoard[row][col] = opponent; // 返還給對方

        // 更新棋盤
        setBoard(newBoard);
        setNeedReturn(false);
        setCapturedPositions([]);
        setReturnedPiece({ row, col });
        // 設置特殊標記，標記這個返還操作
        setLastMoveWasReturn(true);

        // 新增：強制設置有效移動為空數組，確保不會觸發夾殺
        setValidMoves([]);

        // 切換玩家
        console.log(`玩家返還棋子後，切換到對方(${opponent})`);
        setCurrentPlayer(opponent);
        resetTimer();

        // 延長返還操作的標記清除時間
        setTimeout(() => {
            // 在清除返還標記前，再次確保有效移動為空
            setValidMoves([]);

            setIsReturningPiece(false);
            // 保持lastMoveWasReturn為true更長時間，直到下一個玩家完成行動
            setTimeout(() => {
                // 在清除lastMoveWasReturn前再次計算有效移動
                const moves = findValidMoves(currentPlayer, board);
                setValidMoves(moves);

                setLastMoveWasReturn(false);
            }, 200);
        }, 300);
    };

    // 修改後的AI自動返還棋子函數
    const aiAutoReturnPiece = useCallback((flippedPieces) => {
        console.log("AI自動返還棋子開始");

        try {
            // 設置返還標記，阻止任何夾殺邏輯
            setIsReturningPiece(true);

            // 檢查是否有可返還的棋子
            if (flippedPieces && flippedPieces.length > 0) {
                const aiPlayer = playerIsX ? PLAYER.O : PLAYER.X;
                const opponent = aiPlayer === PLAYER.X ? PLAYER.O : PLAYER.X;

                // 找尋價值最低的棋子返還
                let lowestValue = Infinity;
                let bestReturnPos = null;

                for (const [row, col] of flippedPieces) {
                    const value = positionWeights[row][col];
                    if (value < lowestValue) {
                        lowestValue = value;
                        bestReturnPos = [row, col];
                    }
                }

                if (bestReturnPos) {
                    const [row, col] = bestReturnPos;

                    // 創建新的棋盤狀態
                    const newBoard = [...board.map(r => [...r])];

                    // 關鍵修改：只改變一個棋子的顏色，不觸發夾殺邏輯
                    newBoard[row][col] = opponent;

                    // 更新棋盤 - 設置最近返還的位置標記
                    setBoard(newBoard);
                    setReturnedPiece({ row, col });
                    // 添加：設置一個特殊標記，標記這個返還操作
                    setLastMoveWasReturn(true);

                    // 重要：強制設置有效移動為空數組，確保不會觸發夾殺
                    setValidMoves([]);

                    console.log(`AI返還棋子在位置: [${row}, ${col}]`);
                }
            }

            // 清空捕獲列表
            setCapturedPositions([]);

            // 切換到玩家
            const playerPiece = playerIsX ? PLAYER.X : PLAYER.O;
            console.log(`AI自動返子完成，切換到玩家(${playerPiece})`);
            setCurrentPlayer(playerPiece);
            resetTimer();

            // 延長返還標記的清除時間，確保所有狀態更新完成
            setTimeout(() => {
                // 在清除返還標記前，再次確保有效移動為空
                setValidMoves([]);

                setIsReturningPiece(false);
                // 保持lastMoveWasReturn為true更長時間，直到下一個玩家完成行動
                setTimeout(() => {
                    // 最後再計算一次有效移動，確保計算時不會發生夾殺
                    const moves = findValidMoves(currentPlayer, board);
                    setValidMoves(moves);

                    // 然後清除返還標記
                    setLastMoveWasReturn(false);
                }, 200);
            }, 300);
        } catch (error) {
            console.error("AI 自動返子錯誤:", error);
            // 發生錯誤時重置所有狀態
            const playerPiece = playerIsX ? PLAYER.X : PLAYER.O;
            setCapturedPositions([]);
            setCurrentPlayer(playerPiece);
            setIsReturningPiece(false);
            setLastMoveWasReturn(false);
            resetTimer();
        }
    }, [board, playerIsX, resetTimer, positionWeights, findValidMoves, currentPlayer]);

    // AI返還棋子函數（舊的，用於處理needReturn=true的情況）
    const aiReturnPiece = useCallback(() => {
        // 立即清除任何現有計時器，防止多次調用
        if (aiTimeoutRef.current) {
            clearTimeout(aiTimeoutRef.current);
            aiTimeoutRef.current = null;
        }

        // 最關鍵的保障機制：確保返子操作有一個硬性時間限制，無論如何都能繼續
        const safetyTimeout = setTimeout(() => {
            console.log("返子安全機制觸發");
            // 強制結束返還狀態，確保遊戲能繼續
            const aiPlayer = playerIsX ? PLAYER.O : PLAYER.X;
            const opponent = aiPlayer === PLAYER.X ? PLAYER.O : PLAYER.X;
            setNeedReturn(false);
            setCapturedPositions([]);
            setCurrentPlayer(opponent);
            resetTimer();
        }, 3000); // 3秒安全時間

        try {
            // 檢查是否處於需要返還狀態
            if (!needReturn) {
                clearTimeout(safetyTimeout);
                return;
            }

            // 更詳細的返還信息
            console.log("AI嘗試返還子:", {
                capturedPositions,
                currentPlayer,
                playerIsX
            });

            // 如果有可返還的棋子，使用策略選擇最優返還位置
            if (capturedPositions && capturedPositions.length > 0) {
                // 尋找價值最小的位置返還 (通常是邊緣或次要位置)
                let lowestValue = Infinity;
                let bestReturnPos = null;
                const aiPlayer = playerIsX ? PLAYER.O : PLAYER.X;

                for (const [row, col] of capturedPositions) {
                    // 計算此位置的策略價值
                    const posValue = positionWeights[row][col];

                    // 檢查此位置是否會給對手提供好的落子點
                    const newBoard = board.map(row => [...row]);
                    const opponent = aiPlayer === PLAYER.X ? PLAYER.O : PLAYER.X;
                    newBoard[row][col] = opponent; // 返還給對手

                    // 檢查返還後對手能獲得的行動力
                    const opponentMoves = findValidMoves(opponent, newBoard);
                    const mobilityChange = opponentMoves.length - findValidMoves(opponent, board).length;

                    // 綜合評分：位置價值 + 行動力影響
                    const combinedValue = posValue + mobilityChange * 5;

                    if (combinedValue < lowestValue) {
                        lowestValue = combinedValue;
                        bestReturnPos = [row, col];
                    }
                }

                if (bestReturnPos) {
                    const [row, col] = bestReturnPos;
                    // 創建新的棋盤狀態
                    const newBoard = [...board.map(row => [...row])];
                    const aiPlayer = playerIsX ? PLAYER.O : PLAYER.X;
                    const opponent = aiPlayer === PLAYER.X ? PLAYER.O : PLAYER.X;
                    newBoard[row][col] = opponent; // 返還給對手

                    // 更新棋盤
                    setBoard(newBoard);
                    setReturnedPiece({ row, col }); // 記錄返還的棋子位置
                    // 設置返還標記
                    setLastMoveWasReturn(true);

                    // 強制設置有效移動為空數組，確保不會觸發夾殺
                    setValidMoves([]);
                }
            } else {
                console.log("AI 返子警告: 沒有可返還的棋子");
            }

            // 切換玩家
            const aiPlayer = playerIsX ? PLAYER.O : PLAYER.X;
            const opponent = aiPlayer === PLAYER.X ? PLAYER.O : PLAYER.X;
            setNeedReturn(false);
            setCapturedPositions([]);
            console.log(`AI返子完成，切換到玩家(${opponent})`);
            setCurrentPlayer(opponent);
            resetTimer();

            // 延長返還標記的清除時間
            setTimeout(() => {
                // 在清除返還標記前，再次確保有效移動為空
                setValidMoves([]);

                setIsReturningPiece(false);
                // 保持lastMoveWasReturn為true更長時間，直到下一個玩家完成行動
                setTimeout(() => {
                    // 在清除lastMoveWasReturn前再次計算有效移動
                    const moves = findValidMoves(currentPlayer, board);
                    setValidMoves(moves);

                    setLastMoveWasReturn(false);
                }, 200);
            }, 300);

            // 已成功處理，清除安全計時器
            clearTimeout(safetyTimeout);
        } catch (error) {
            console.error("AI 返子錯誤:", error);
            // 發生錯誤時，確保遊戲能繼續
            const aiPlayer = playerIsX ? PLAYER.O : PLAYER.X;
            const opponent = aiPlayer === PLAYER.X ? PLAYER.O : PLAYER.X;
            setNeedReturn(false);
            setCapturedPositions([]);
            setCurrentPlayer(opponent);
            setLastMoveWasReturn(false);
            resetTimer();
            // 已處理錯誤，清除安全計時器
            clearTimeout(safetyTimeout);
        }
    }, [board, capturedPositions, needReturn, playerIsX, resetTimer, positionWeights, findValidMoves, currentPlayer]);
    // 強化版AI落子策略
    const makeAIMove = useCallback(() => {
        // 防止重複調用：如果已經在進行AI動作，則直接返回
        if (isAIMoving.current) {
            console.log("AI已經在行動中，忽略重複調用");
            return;
        }

        // 設置標誌，表示AI正在行動
        isAIMoving.current = true;

        // 立即清除任何現有計時器，防止多次調用
        if (aiTimeoutRef.current) {
            clearTimeout(aiTimeoutRef.current);
            aiTimeoutRef.current = null;
        }

        const aiPlayer = playerIsX ? PLAYER.O : PLAYER.X;

        // 添加更詳細的診斷信息
        console.log("makeAIMove被調用", {
            currentPlayer,
            aiPlayer,
            playerIsX,
            gameOver,
            needReturn,
            board: board.flat().filter(cell => cell !== null).length // 檢查棋盤狀態
        });

        // 添加更多診斷信息，並確保條件檢查正確
        if (currentPlayer !== aiPlayer || gameOver || needReturn || isReturningPiece || lastMoveWasReturn) {
            console.log("AI落子被阻止:", {
                當前玩家: currentPlayer,
                應為AI玩家: aiPlayer,
                遊戲結束: gameOver,
                需要返還棋子: needReturn,
                正在返還: isReturningPiece,
                剛剛返還: lastMoveWasReturn,
                playerIsX: playerIsX
            });

            // 取消AI行動標誌
            isAIMoving.current = false;
            return;
        }

        // 在最外層用try-catch包裹所有邏輯，確保不會卡死
        try {
            const aiMoves = findValidMoves(aiPlayer, board);
            console.log(`AI可用的移動: ${aiMoves.length}個選項`);

            // 如果沒有有效的落子位置，AI會PASS
            if (aiMoves.length === 0) {
                const playerMoves = findValidMoves(playerIsX ? PLAYER.X : PLAYER.O, board);
                if (playerMoves.length === 0) {
                    // 雙方都無法下子，遊戲結束
                    console.log("雙方都無法落子，遊戲結束");
                    endGame();
                    isAIMoving.current = false;
                    return;
                }

                // AI PASS
                console.log("AI無子可下，PASS");
                setCurrentPlayer(playerIsX ? PLAYER.X : PLAYER.O);
                resetTimer();
                isAIMoving.current = false;
                return;
            }

            // 如果是遊戲開始階段 (前4步)，使用開局庫
            const totalPieces = board.flat().filter(cell => cell !== PLAYER.EMPTY).length;

            if (totalPieces < 8) {
                // 簡單的開局策略 - 優先選擇角落附近的穩定位置
                const preferredMoves = aiMoves.filter(move => {
                    // 檢查是否是角落或靠近角落的好位置
                    return (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7) ||
                        (move.row === 2 || move.row === 5) && (move.col === 2 || move.col === 5);
                });

                if (preferredMoves.length > 0) {
                    // 從優先位置中選擇翻轉最多棋子的位置
                    preferredMoves.sort((a, b) => b.flippable.length - a.flippable.length);
                    const bestMove = preferredMoves[0];

                    // 創建新的棋盤狀態
                    const newBoard = board.map(row => [...row]);
                    newBoard[bestMove.row][bestMove.col] = aiPlayer;

                    // 記錄被吃的子
                    const flippedPieces = [...bestMove.flippable];
                    setCapturedPositions(flippedPieces);

                    // 翻轉被夾殺的子
                    for (const [r, c] of flippedPieces) {
                        newBoard[r][c] = aiPlayer;
                    }

                    // 更新棋盤
                    setBoard(newBoard);
                    setReturnedPiece(null);

                    // 保存歷史記錄
                    setGameHistory(prev => [...prev, {
                        board: board,
                        move: { row: bestMove.row, col: bestMove.col, player: aiPlayer }
                    }]);

                    // 如果吃掉2子以上，AI自動返還一子
                    if (flippedPieces.length >= 2) {
                        console.log("AI吃了2子以上，準備自動返還");
                        // 使用Promise確保狀態更新完成
                        Promise.resolve()
                            .then(() => {
                                // 儲存被吃的子，但不設置needReturn
                                setCapturedPositions(flippedPieces);
                            })
                            .then(() => {
                                // 延遲一下以便看到效果，然後AI自動返還
                                setTimeout(() => {
                                    console.log("執行AI自動返子");
                                    // 直接調用AI自動返還函數
                                    aiAutoReturnPiece(flippedPieces);
                                    isAIMoving.current = false;
                                }, 1500);
                            });
                        return;
                    }

                    // 切換回玩家
                    const playerPiece = playerIsX ? PLAYER.X : PLAYER.O;
                    console.log(`AI落子完成，切換到玩家(${playerPiece})`);
                    setCurrentPlayer(playerPiece);
                    resetTimer();
                    isAIMoving.current = false;
                    return;
                }
            }

            // 使用Minimax算法搜索最佳移動
            let bestScore = -Infinity;
            let bestMove = null;

            // 決定搜索深度 - 根據可用的有效移動數量動態調整
            // 移動較少時可以搜索更深，移動多時淺一點以節省計算時間
            const searchDepth = aiMoves.length <= 5 ? 5 :
                (aiMoves.length <= 10 ? 4 : 3);

            for (const move of aiMoves) {
                // 模擬此落子
                const newBoard = board.map(row => [...row]);
                newBoard[move.row][move.col] = aiPlayer;

                // 翻轉被夾殺的子
                for (const [r, c] of move.flippable) {
                    newBoard[r][c] = aiPlayer;
                }

                // 如果吃掉2子以上，需要返還（模擬最佳情況）
                if (move.flippable.length >= 2) {
                    // 先不考慮返還，在評估中會考慮
                    // 現實中的返還會在aiAutoReturnPiece中處理
                }

                // 評估此落子的分數 - 使用Minimax算法
                const score = minimax(newBoard, searchDepth - 1, -Infinity, Infinity, false, aiPlayer);

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }

            if (bestMove) {
                // 創建新的棋盤狀態
                const newBoard = board.map(row => [...row]);
                newBoard[bestMove.row][bestMove.col] = aiPlayer;

                // 記錄被吃的子
                const flippedPieces = [...bestMove.flippable]; // 確保是新的數組
                setCapturedPositions(flippedPieces);

                // 翻轉被夾殺的子
                for (const [r, c] of flippedPieces) {
                    newBoard[r][c] = aiPlayer;
                }

                // 更新棋盤
                setBoard(newBoard);
                setReturnedPiece(null); // 清除之前的返還記錄

                // 保存歷史記錄
                setGameHistory(prev => [...prev, {
                    board: board,
                    move: { row: bestMove.row, col: bestMove.col, player: aiPlayer }
                }]);

                // 如果吃掉2子以上，AI自動返還一子
                if (flippedPieces.length >= 2) {
                    console.log("AI吃了2子以上，準備自動返還");
                    // 使用Promise確保狀態更新完成
                    Promise.resolve()
                        .then(() => {
                            // 儲存被吃的子，但不設置needReturn
                            setCapturedPositions(flippedPieces);
                        })
                        .then(() => {
                            // 延遲一下以便看到效果，然後AI自動返還
                            setTimeout(() => {
                                console.log("執行AI自動返子");
                                // 直接調用AI自動返還函數
                                aiAutoReturnPiece(flippedPieces);
                                isAIMoving.current = false;
                            }, 1500);
                        });
                    return;
                }

                // 切換到玩家時進行明確記錄
                const playerPiece = playerIsX ? PLAYER.X : PLAYER.O;
                console.log(`AI落子完成，切換到玩家(${playerPiece})`);
                setCurrentPlayer(playerPiece);
                resetTimer();
                isAIMoving.current = false;
            } else {
                // 如果沒有找到最佳移動但有可用移動，這是一個保險機制
                console.log("警告: 有可用移動但未找到最佳移動");
                const playerPiece = playerIsX ? PLAYER.X : PLAYER.O;
                setCurrentPlayer(playerPiece);
                resetTimer();
                isAIMoving.current = false;
            }
        } catch (error) {
            console.error("AI 落子錯誤:", error);
            // 發生錯誤時，確保遊戲能繼續
            const playerPiece = playerIsX ? PLAYER.X : PLAYER.O;
            setCurrentPlayer(playerPiece);
            resetTimer();
            isAIMoving.current = false;
        }
    }, [board, currentPlayer, findValidMoves, gameHistory, gameOver, needReturn, resetTimer, aiAutoReturnPiece, playerIsX, endGame, minimax, isReturningPiece, lastMoveWasReturn]);

    // 玩家落子 - 修改後的版本
    const placePiece = (row, col) => {
        // 如果正在返還或剛剛返還，阻止落子
        if (isReturningPiece || lastMoveWasReturn) {
            console.log("落子被阻止 - 正在返還或剛剛返還棋子");
            return;
        }

        // 檢查是否是PVP模式且不是玩家1的回合
        if (!gameOptions.againstAI && currentPlayer === PLAYER.O) {
            // 在PVP模式下，兩個玩家輪流在同一台電腦上操作
            const validMove = validMoves.find(move => move.row === row && move.col === col);
            if (!validMove) return; // 無效的落子位置

            // 創建新的棋盤狀態
            const newBoard = board.map(r => [...r]);
            newBoard[row][col] = PLAYER.O;

            // 記錄被吃的子
            const flippedPieces = validMove.flippable;
            setCapturedPositions(flippedPieces);

            // 翻轉被夾殺的子
            for (const [r, c] of flippedPieces) {
                newBoard[r][c] = PLAYER.O;
            }

            // 更新棋盤
            setBoard(newBoard);
            setReturnedPiece(null);

            // 保存歷史記錄
            setGameHistory([...gameHistory, {
                board: board,
                move: { row, col, player: PLAYER.O }
            }]);

            // 檢查是否需要返還子
            if (flippedPieces.length >= 2) {
                // 在PVP模式下需要手動返還
                setNeedReturn(true);
                return;
            }

            // 切換玩家
            setCurrentPlayer(PLAYER.X);
            resetTimer();
            return;
        }

        // AI模式下玩家的回合
        const playerPiece = playerIsX ? PLAYER.X : PLAYER.O;

        // 添加更多日誌幫助調試
        console.log("玩家嘗試落子:", {
            row, col,
            currentPlayer,
            playerPiece,
            playerIsX,
            gameOver,
            needReturn
        });

        if (currentPlayer !== playerPiece || gameOver || needReturn) {
            console.log("玩家無法落子，條件不滿足");
            return;
        }

        const validMove = validMoves.find(move => move.row === row && move.col === col);

        if (!validMove) {
            console.log("無效的落子位置");
            return;
        }

        // 創建新的棋盤狀態
        const newBoard = board.map(r => [...r]);
        newBoard[row][col] = playerPiece;

        // 記錄被吃的子
        const flippedPieces = validMove.flippable;
        setCapturedPositions(flippedPieces);

        // 翻轉被夾殺的子
        for (const [r, c] of flippedPieces) {
            newBoard[r][c] = playerPiece;
        }

        // 更新棋盤
        setBoard(newBoard);
        setReturnedPiece(null); // 清除之前的返還記錄

        // 保存歷史記錄
        setGameHistory([...gameHistory, {
            board: board,
            move: { row, col, player: playerPiece }
        }]);

        // 檢查是否需要返還子
        if (flippedPieces.length >= 2) {
            // 在AI模式下玩家吃子需要手動返還
            setNeedReturn(true);
            return;
        }

        // 在AI模式下，一定要切換到AI
        if (gameOptions.againstAI) {
            const aiPlayer = playerIsX ? PLAYER.O : PLAYER.X;
            console.log("玩家落子完成，切換到AI:", aiPlayer);
            setCurrentPlayer(aiPlayer);
            resetTimer();

            // 注意：這裡不再直接調用makeAIMove，讓useEffect來負責這個工作
            // 此修改可以避免重複觸發AI行動
        } else {
            // PVP模式邏輯
            setCurrentPlayer(playerPiece === PLAYER.X ? PLAYER.O : PLAYER.X);
            resetTimer();
        }
    };

    // PASS - 修改後的版本
    const passTurn = () => {
        if (gameOver || needReturn || isReturningPiece || lastMoveWasReturn) return;

        // 確定當前玩家
        let currentPlayerPiece;
        let nextPlayerPiece;

        if (gameOptions.againstAI) {
            // AI模式
            currentPlayerPiece = playerIsX ? PLAYER.X : PLAYER.O;
            nextPlayerPiece = currentPlayerPiece === PLAYER.X ? PLAYER.O : PLAYER.X;

            if (currentPlayer !== currentPlayerPiece) return;
        } else {
            // PVP模式
            currentPlayerPiece = currentPlayer;
            nextPlayerPiece = currentPlayerPiece === PLAYER.X ? PLAYER.O : PLAYER.X;
        }

        // 只有在無法下子時才能PASS
        if (validMoves.length > 0) {
            alert('有可以落子的位置，不能PASS！');
            return;
        }

        // 檢查對手是否也無法落子
        const nextPlayerMoves = findValidMoves(nextPlayerPiece, board);
        if (nextPlayerMoves.length === 0) {
            // 雙方都無法下子，遊戲結束
            console.log("雙方都無法落子，觸發遊戲結束");
            endGame();
            return;
        }

        // 切換玩家
        setCurrentPlayer(nextPlayerPiece);
        resetTimer();

        // 不再直接調用AI，讓useEffect負責
    };

    // 切換先後手
    const togglePlayerOrder = () => {
        if (!gameOver && getScore(PLAYER.X) + getScore(PLAYER.O) > 4) {
            // 遊戲已經開始，不能切換
            alert('遊戲已經開始，無法切換先後手！');
            return;
        }

        setPlayerIsX(!playerIsX);
        restartGame(!playerIsX, gameOptions.againstAI);
    };

    // 重新開始遊戲
    const restartGame = (newPlayerIsX = playerIsX, againstAI = gameOptions.againstAI) => {
        console.log("重新開始遊戲", { newPlayerIsX, againstAI });

        // 清除所有timeout和interval
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (aiTimeoutRef.current) {
            clearTimeout(aiTimeoutRef.current);
            aiTimeoutRef.current = null;
        }

        // 重置AI行動標誌
        isAIMoving.current = false;

        // 使用函數式更新確保使用最新狀態
        setBoard(initialBoard());
        setCurrentPlayer(PLAYER.X); // X永遠先手
        setGameStatus('正在進行中');
        setGameHistory([]);
        setNeedReturn(false);
        setCapturedPositions([]);
        setGameOver(false);
        setReturnedPiece(null);
        setPlayerIsX(newPlayerIsX); // 確保這個狀態正確設置
        setIsReturningPiece(false);
        setLastMoveWasReturn(false);
        setValidMoves([]); // 確保有效移動為空

        // 更新遊戲選項
        setGameOptions({
            playerIsFirst: newPlayerIsX,
            againstAI: againstAI
        });

        // 重置計時器（這應該在所有狀態更新後執行）
        setTimeout(() => {
            resetTimer();

            // 重要：如果是AI模式且玩家是後手(O)，則X是AI，需要立即觸發AI落子
            if (againstAI && !newPlayerIsX) {
                console.log("AI先手，準備落子...");
                // 使用setTimeout確保狀態已更新
                setTimeout(() => {
                    console.log("AI開始落子");
                    // 此時狀態已更新，可以安全調用makeAIMove
                    if (aiTimeoutRef.current) {
                        clearTimeout(aiTimeoutRef.current);
                        aiTimeoutRef.current = null;
                    }
                    makeAIMove();
                }, 500);
            }
        }, 100);
    };

    // 計算得分
    const getScore = (player) => {
        let count = 0;
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row][col] === player) {
                    count++;
                }
            }
        }
        return count;
    };

    // 更新有效的落子位置 - 修改後的版本
    useEffect(() => {
        // 如果遊戲未開始或已結束，不更新
        if (!gameStarted || gameOver) return;

        // 如果正在返還棋子或最近一次操作是返還，不執行夾殺判斷
        if (isReturningPiece || lastMoveWasReturn) {
            console.log("跳過夾殺檢查 - 正在返還或剛剛返還棋子");
            // 確保有效移動為空，防止顯示任何可能的夾殺位置
            setValidMoves([]);
            return;
        }

        // 只有在非返還狀態下才計算有效移動
        const moves = findValidMoves(currentPlayer, board);
        setValidMoves(moves);
    }, [board, currentPlayer, gameStarted, gameOver, findValidMoves, isReturningPiece, lastMoveWasReturn]);

    // 新增：監聽返還操作後的棋盤變化，確保不發生夾殺
    useEffect(() => {
        // 如果沒有剛剛返還棋子，或者沒有返還位置記錄，直接返回
        if (!lastMoveWasReturn || !returnedPiece) return;

        // 記錄當前玩家和返還棋子位置
        const { row, col } = returnedPiece;
        const currentPiece = currentPlayer;

        console.log("返還後檢查：確保不會觸發夾殺", {
            返還位置: [row, col],
            當前玩家: currentPiece,
            lastMoveWasReturn
        });

        // 確保有效移動為空，防止任何夾殺
        setValidMoves([]);

        // 此useEffect僅確保返還後的第一次更新不會觸發夾殺
        // 防止追蹤變量變化導致多次執行
        return () => { };
    }, [lastMoveWasReturn, returnedPiece, currentPlayer]);

    // 初始化遊戲和計時器
    useEffect(() => {
        if (gameStarted) {
            resetTimer();
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (aiTimeoutRef.current) {
                clearTimeout(aiTimeoutRef.current);
                aiTimeoutRef.current = null;
            }
        };
    }, [gameStarted, resetTimer]);

    // 修改監控AI回合的useEffect
    useEffect(() => {
        if (!gameStarted || !gameOptions.againstAI) return;

        const aiPlayer = playerIsX ? PLAYER.O : PLAYER.X;

        // 增強調試信息
        console.log("AI Effect觸發", {
            currentPlayer,
            aiPlayer,
            playerIsX,
            needReturn,
            gameOver,
            AIMoving: isAIMoving.current,
            isReturning: isReturningPiece,
            lastMoveWasReturn,
            boardSize: board.flat().filter(cell => cell !== null).length,
            遊戲選項: gameOptions
        });

        if (currentPlayer === aiPlayer && !needReturn && !gameOver && !isAIMoving.current && !isReturningPiece && !lastMoveWasReturn) {
            console.log("準備執行AI行動");
            // 清除可能存在的舊計時器
            if (aiTimeoutRef.current) {
                clearTimeout(aiTimeoutRef.current);
                aiTimeoutRef.current = null;
            }

            // 設置新的計時器，確保有足夠時間讓 state 更新
            console.log("安排AI行動計時器");
            aiTimeoutRef.current = setTimeout(() => {
                console.log("執行AI行動 (來自Effect)");
                makeAIMove();
            }, 800);

            // 清理函數
            return () => {
                if (aiTimeoutRef.current) {
                    clearTimeout(aiTimeoutRef.current);
                    aiTimeoutRef.current = null;
                    console.log("清理AI計時器");
                }
            };
        }
    }, [currentPlayer, needReturn, gameOver, makeAIMove, playerIsX, gameOptions, gameStarted, board, isReturningPiece, lastMoveWasReturn]);

    // 確保初始化函數中也能正確觸發AI
    useEffect(() => {
        // 當遊戲剛開始且玩家是後手(O)時，立即觸發AI(X)行動
        if (gameStarted && gameOptions.againstAI && !playerIsX && currentPlayer === PLAYER.X && !gameOver && !isAIMoving.current) {
            console.log("初始化時觸發AI先手");

            if (aiTimeoutRef.current) {
                clearTimeout(aiTimeoutRef.current);
                aiTimeoutRef.current = null;
            }

            aiTimeoutRef.current = setTimeout(() => {
                makeAIMove();
            }, 1000);

            return () => {
                if (aiTimeoutRef.current) {
                    clearTimeout(aiTimeoutRef.current);
                    aiTimeoutRef.current = null;
                }
            };
        }
    }, [gameStarted, gameOptions.againstAI, playerIsX, currentPlayer, gameOver, makeAIMove]);

    // 渲染方法 - 修改後的版本
    const renderCell = (row, col) => {
        // 檢查是否是有效的落子位置 - 如果正在返還或剛剛返還，不應有效落子位置
        const isValid = !isReturningPiece && !lastMoveWasReturn &&
            validMoves.some(move => move.row === row && move.col === col);

        // 檢查是否是可以被返還的位置
        const isCaptured = needReturn && capturedPositions.some(([r, c]) => r === row && c === col);

        // 檢查是否是最近返還的位置
        const isReturned = returnedPiece && returnedPiece.row === row && returnedPiece.col === col;

        // 設置CSS類
        let cellClass = 'grid-cell';
        if (isValid) cellClass += ' valid-move';
        if (isCaptured) cellClass += ' captured-cell';
        if (isReturned) cellClass += ' returned-cell';

        // 處理點擊事件
        const handleClick = () => {
            // 增加防呆判斷：如果正在返還或剛剛返還，阻止任何棋盤互動
            if (isReturningPiece || lastMoveWasReturn) {
                console.log("棋盤操作被阻止 - 正在返還或剛剛返還棋子");
                return;
            }

            if (isCaptured) {
                returnPiece(row, col);
            } else if (isValid) {
                placePiece(row, col);
            }
        };

        return (
            <div key={`${row}-${col}`} className={cellClass} onClick={handleClick}>
                {board[row][col] === PLAYER.X && <div className="piece piece-x"></div>}
                {board[row][col] === PLAYER.O && <div className="piece piece-o"></div>}
                {board[row][col] === PLAYER.EMPTY && isValid && <div className="move-hint"></div>}
                {isCaptured && <div className="return-hint"></div>}
            </div>
        );
    };

    // 渲染列標題 (A-H)
    const renderColHeader = (col) => {
        const colLabel = String.fromCharCode(65 + col); // A, B, C, ...
        return (
            <div key={`header-col-${col}`} className="grid-header">
                {colLabel}
            </div>
        );
    };

    // 渲染行標題 (1-8)
    const renderRowHeader = (row) => {
        return (
            <div key={`header-row-${row}`} className="grid-header">
                {row + 1}
            </div>
        );
    };
    // 如果遊戲未開始，顯示開始界面
    if (!gameStarted) {
        return <GameStart onStartGame={handleGameStart} />;
    }

    // 主要遊戲渲染
    return (
        <div className="reversi-container">
            <h1 className="reversi-title">黑白棋</h1>

            <div className="reversi-game-layout">
                {/* 棋盤 */}
                <div className="game-board">
                    <div className="grid-container">
                        {/* 左上角空白 */}
                        <div className="grid-header"></div>

                        {/* 列標題 (A-H) */}
                        {Array(BOARD_SIZE).fill().map((_, col) => renderColHeader(col))}

                        {/* 棋盤行 */}
                        {Array(BOARD_SIZE).fill().map((_, row) => (
                            <React.Fragment key={`row-${row}`}>
                                {/* 行標題 (1-8) */}
                                {renderRowHeader(row)}

                                {/* 棋盤格子 */}
                                {Array(BOARD_SIZE).fill().map((_, col) => renderCell(row, col))}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* 遊戲信息區 */}
                <div className="game-info-container">
                    <div className="game-info">
                        <div className="info-section">
                            <h2 className="section-title">遊戲狀態</h2>
                            <div className={`game-status ${gameOver ? 'winner-status' : ''}`}>
                                {gameStatus}
                            </div>
                        </div>

                        <div className="info-section">
                            <h2 className="section-title">當前玩家</h2>
                            <div className={`current-player ${currentPlayer === (playerIsX ? PLAYER.O : PLAYER.X) && gameOptions.againstAI ? 'ai-turn' : ''}`}>
                                <div className={`player-indicator ${currentPlayer === PLAYER.X ? 'player-x' : 'player-o'}`}></div>
                                <span className="player-text">
                                    {currentPlayer === PLAYER.X
                                        ? (gameOptions.againstAI
                                            ? (playerIsX ? '玩家(黑)' : '電腦(黑)')
                                            : '玩家1(黑)')
                                        : (gameOptions.againstAI
                                            ? (playerIsX ? '電腦(白)' : '玩家(白)')
                                            : '玩家2(白)')}
                                </span>
                            </div>

                            {needReturn && (
                                <div className="return-notice">
                                    <p>您吃掉對方兩子以上，請選擇一子返還</p>
                                    <p className="return-instruction">點擊任意一個<span style={{ color: 'red', fontWeight: 'bold' }}>紅色閃爍</span>的棋子進行返還</p>
                                </div>
                            )}

                            {returnedPiece && !needReturn && (
                                <div className="return-notice success">
                                    <p>{currentPlayer !== (playerIsX ? PLAYER.X : PLAYER.O) && gameOptions.againstAI ? "AI已" : "已"}返還一子給對方</p>
                                </div>
                            )}
                        </div>

                        <div className="info-section timer-section">
                            <h2 className="section-title">計時器</h2>
                            <div className={`timer ${timer <= 10 ? 'timer-warning' : ''}`}>
                                {timer}
                            </div>
                        </div>

                        <div className="info-section">
                            <h2 className="section-title">分數</h2>
                            <div className="score-section">
                                <div className="player-score x-score">
                                    <p>{`黑棋: ${getScore(PLAYER.X)}`}</p>
                                </div>
                                <div className="player-score o-score">
                                    <p>{`白棋: ${getScore(PLAYER.O)}`}</p>
                                </div>
                            </div>
                        </div>

                        <div className="info-section">
                            <h2 className="section-title">操作</h2>
                            <div className="button-group">
                                <button
                                    className={`pass-button ${validMoves.length > 0 || isReturningPiece || lastMoveWasReturn ? 'disabled-button' : ''}`}
                                    onClick={passTurn}
                                    disabled={validMoves.length > 0 || needReturn || isReturningPiece || lastMoveWasReturn}
                                >
                                    PASS
                                </button>
                                <button className="restart-button" onClick={() => restartGame()}>
                                    重新開始
                                </button>
                            </div>
                            <button className="toggle-order-button" onClick={togglePlayerOrder} style={{ marginTop: '10px' }}>
                                切換先後手
                            </button>
                        </div>
                    </div>

                    <div className="rules-section">
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
                        <button
                            className="rules-button"
                            onClick={returnToStart}
                            style={{
                                marginTop: '15px',
                                padding: '10px 15px',
                                width: '100%',
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.5rem'
                            }}
                        >
                            返回開始界面
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reversi;