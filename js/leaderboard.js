// Leaderboard integration with Supabase
const SUPABASE_URL = 'https://salaqfgboykedzbzufxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbGFxZmdib3lrZWR6Ynp1ZnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzc5NTksImV4cCI6MjA3NTk1Mzk1OX0.4iULX-ffPl8zIBoTi1hGTTw6hoI69J0Q_JS1U3VHeVc';

// Initialize Supabase client
let supabaseClient = null;
try {
    const { createClient } = window.supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully');
} catch (err) {
    console.error('Failed to initialize Supabase:', err);
}

// Leaderboard state
const LeaderboardManager = {
    scores: [],
    isLoading: false,
    lastSubmittedRank: null,
    playerName: localStorage.getItem('apeFlukt_playerName') || '',

    // Fetch top 10 scores
    async fetchScores() {
        if (!supabaseClient) {
            console.error('Supabase client not initialized');
            this.isLoading = false;
            return [];
        }

        this.isLoading = true;
        try {
            const { data, error } = await supabaseClient
                .from('scores')
                .select('*')
                .order('score', { ascending: false })
                .limit(10);

            if (error) {
                console.error('Error fetching leaderboard:', error);
                this.isLoading = false;
                return [];
            }

            this.scores = data || [];
            console.log('Fetched scores:', this.scores);
            return this.scores;
        } catch (err) {
            console.error('Leaderboard fetch failed:', err);
            return [];
        } finally {
            this.isLoading = false;
        }
    },

    // Submit a score
    async submitScore(score, levelReached, playerName) {
        if (!supabaseClient) {
            console.error('Supabase client not initialized');
            return null;
        }

        const name = playerName.trim() || 'Anonymous';

        // Save name for next time
        if (name !== 'Anonymous') {
            localStorage.setItem('apeFlukt_playerName', name);
            this.playerName = name;
        }

        try {
            const { data, error } = await supabaseClient
                .from('scores')
                .insert([{
                    player_name: name.substring(0, 20),
                    score: score,
                    level_reached: levelReached
                }])
                .select();

            if (error) {
                console.error('Error submitting score:', error);
                return null;
            }

            // Get rank of submitted score
            const { count } = await supabaseClient
                .from('scores')
                .select('*', { count: 'exact', head: true })
                .gt('score', score);

            this.lastSubmittedRank = (count || 0) + 1;

            // Refresh leaderboard
            await this.fetchScores();

            return this.lastSubmittedRank;
        } catch (err) {
            console.error('Score submission failed:', err);
            return null;
        }
    },

    // Check if score would make top 10
    async wouldMakeLeaderboard(score) {
        if (this.scores.length < 10) return true;
        const lowestTop10 = this.scores[this.scores.length - 1]?.score || 0;
        return score > lowestTop10;
    }
};

// Initialize - fetch scores on load
LeaderboardManager.fetchScores();
