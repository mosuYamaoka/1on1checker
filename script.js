document.addEventListener('DOMContentLoaded', () => {
    const transcriptInput = document.getElementById('transcript');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultContainer = document.getElementById('result-container');
    const scoreEl = document.getElementById('score');
    const scoreCircleEl = document.getElementById('score-circle');
    const detailsEl = document.getElementById('details');

    // --- 分析ロジック ---

    // 簡易的な感情辞書
    const positiveWords = ['ありがとうございます', '感謝', '嬉しい', '楽しい', '満足', 'やりがい', '成長', '学び', '貢献', '改善', '積極的', '面白い', 'なるほど', 'よくわかりました', '承知しました'];
    const negativeWords = ['しかし', 'でも', '不満', '問題', '難しい', '厳しい', '懸念', '不安', '大変', '辛い', '辞めたい', '退職', '異動', '無理', 'ちょっと', 'わからない', '検討します'];

    // 詰まり語
    const fillerWords = ['えーっと', 'あのー', 'えー', 'あー', 'まあ', 'そのー', 'えっと', 'あの', 'なんか', 'こう', 'なんていうか', 'えっとですね', 'そうですね', 'うーん', 'はい', 'えーと', 'まー', 'なんかー', 'こうー', 'なんというか', 'えーとですね'];

    // ジョブサーチ関連語
    const jobSearchWords = ['転職', 'キャリア', 'エージェント', '面接', '他社', '市場価値', '次のステップ', '将来', '環境を変えたい'];

    const employeeNameInput = document.getElementById('employee-name');

    analyzeBtn.addEventListener('click', () => {
        const employeeName = employeeNameInput.value.trim();
        const text = transcriptInput.value.trim();

        if (!employeeName) {
            alert('部下の名前を入力してください。');
            return;
        }
        if (!text) {
            alert('文字起こしデータを入力してください。');
            return;
        }

        // 各特徴量を計算
        const sentimentResult = calculateSentimentFeatures(text);
        const engagementResult = calculateEngagementFeatures(text, employeeName);
        const jobSearchResult = calculateJobSearchFeatures(text);

        // 総合スコアを計算 (重み付けは仮)
        const finalScore = calculateFinalScore(
            sentimentResult.score,
            engagementResult.score,
            jobSearchResult.score
        );

        // 結果を表示
        displayResults(finalScore, sentimentResult, engagementResult, jobSearchResult);
    });

    function calculateSentimentFeatures(text) {
        const words = text.split(/\s+/);
        let positiveCount = 0;
        let negativeCount = 0;

        words.forEach(word => {
            if (positiveWords.some(p => word.includes(p))) positiveCount++;
            if (negativeWords.some(n => word.includes(n))) negativeCount++;
        });

        // ネガティブな単語が多いほどスコアが高くなる (0-100)
        const score = Math.min(100, (negativeCount / (words.length / 100)) * 10);
        return {
            label: '① 感情トーン＆変動',
            score: score,
            details: [
                { label: 'ポジティブ単語数', value: positiveCount },
                { label: 'ネガティブ単語数', value: negativeCount },
            ]
        };
    }

    function calculateEngagementFeatures(text, employeeName) {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        // 半角・全角のコロンに対応し、名前に続くコロンとスペースにマッチする正規表現
        const employeeIdentifierRegex = new RegExp(`^${employeeName}[:：]\s*`);

        const employeeLines = lines.filter(line => employeeIdentifierRegex.test(line.trim()));
        
        if (employeeLines.length === 0) {
            return { label: '② エンゲージメント量', score: 50, details: [{label: `「${employeeName}」さんの発言が見つかりません`, value: ''}] };
        }

        const employeeText = employeeLines.map(line => line.replace(employeeIdentifierRegex, '').trim()).join(' ');
        const employeeWords = employeeText.split(/\s+/);

        // 社員発話比率
        const speechRatio = (employeeLines.length / lines.length) * 100;

        // 平均トークン長 (簡易的に文字数で)
        const avgTokenLength = employeeWords.join('').length / employeeWords.length;

        // 詰まり語の頻度
        const fillerCount = fillerWords.reduce((acc, word) => acc + (employeeText.match(new RegExp(word, 'g')) || []).length, 0);
        const fillerRate = (fillerCount / employeeWords.length) * 100;

        // スコアリング (低いエンゲージメントほど高スコア)
        let score = 0;
        if (speechRatio < 30) score += 30;
        if (avgTokenLength < 10) score += 20;
        if (fillerRate > 5) score += 30; // 詰まり語が5%以上
        score = Math.min(100, score);

        return {
            label: '② エンゲージメント量',
            score: score,
            details: [
                { label: '社員発話比率', value: `${speechRatio.toFixed(1)}%` },
                { label: '平均単語長', value: `${avgTokenLength.toFixed(1)}文字` },
                { label: '詰まり語/100語', value: `${fillerRate.toFixed(1)}回` },
            ]
        };
    }

    function calculateJobSearchFeatures(text) {
        const words = text.split(/\s+/);
        let keywordCount = 0;

        jobSearchWords.forEach(jobWord => {
            if (text.includes(jobWord)) {
                keywordCount += (text.match(new RegExp(jobWord, 'g')) || []).length;
            }
        });

        // 転職関連キーワードが多いほどスコアが高くなる
        const score = Math.min(100, keywordCount * 20);

        return {
            label: '③ ジョブサーチ暗示語',
            score: score,
            details: [
                { label: '転職関連キーワード頻度', value: keywordCount },
            ]
        };
    }

    function calculateFinalScore(sentiment, engagement, jobSearch) {
        // 重み付け: 感情60%, エンゲージメント20%, ジョブサーチ20%
        const score = (sentiment * 0.6) + (engagement * 0.2) + (jobSearch * 0.2);
        return Math.round(score);
    }

    function displayResults(finalScore, ...featureResults) {
        // スコア表示
        scoreEl.textContent = finalScore;

        // スコアに応じて色を変更
        let color = '#007bff'; // 青 (低リスク)
        if (finalScore >= 70) {
            color = '#dc3545'; // 赤 (高リスク)
        } else if (finalScore >= 40) {
            color = '#ffc107'; // 黄 (中リスク)
        }
        scoreCircleEl.style.borderColor = color;
        scoreEl.style.color = color;

        // 詳細表示
        detailsEl.innerHTML = ''; // 前回の結果をクリア
        featureResults.forEach(result => {
            const item = document.createElement('div');
            item.className = 'detail-item';
            
            let content = `<h3>${result.label} (スコア: ${result.score.toFixed(0)})</h3>`;
            result.details.forEach(detail => {
                content += `<p>${detail.label}: <span class="value">${detail.value}</span></p>`;
            });

            item.innerHTML = content;
            detailsEl.appendChild(item);
        });

        resultContainer.classList.remove('hidden');
    }
});
