use near_sdk::near;

/// Track ids from nearhackathon.com plus the overall grand prize.
pub const CATEGORIES: [&str; 14] = [
    "defi", "thesis", "privacy", "business", "swarms", "security", "agents", "realworld", "games",
    "nfts", "memecoins", "social", "open", "grand",
];

pub const GRAND: &str = "grand";

/// Ordered project ids (NearHunt submission ids) for one category.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct CategoryPicks {
    pub category: String,
    pub ids: Vec<String>,
}

/// +3 for a winner at the exact rank, +1 if elsewhere in the player's top 3,
/// +5 for the grand prize winner.
pub fn score(picks: &[CategoryPicks], results: &[CategoryPicks]) -> u32 {
    let mut total = 0;
    for result in results {
        let Some(mine) = picks.iter().find(|p| p.category == result.category) else {
            continue;
        };
        for (rank, winner) in result.ids.iter().enumerate() {
            if result.category == GRAND {
                if rank == 0 && mine.ids.first() == Some(winner) {
                    total += 5;
                }
            } else if mine.ids.get(rank) == Some(winner) {
                total += 3;
            } else if mine.ids.contains(winner) {
                total += 1;
            }
        }
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cp(category: &str, ids: &[&str]) -> CategoryPicks {
        CategoryPicks { category: category.to_string(), ids: ids.iter().map(|s| s.to_string()).collect() }
    }

    #[test]
    fn exact_rank_scores_3() {
        assert_eq!(score(&[cp("swarms", &["a", "b", "c"])], &[cp("swarms", &["a", "x", "y"])]), 3);
    }

    #[test]
    fn in_top3_wrong_rank_scores_1() {
        assert_eq!(score(&[cp("swarms", &["b", "a", "c"])], &[cp("swarms", &["a", "x", "y"])]), 1);
    }

    #[test]
    fn grand_correct_scores_5() {
        assert_eq!(score(&[cp("grand", &["g"])], &[cp("grand", &["g"])]), 5);
        assert_eq!(score(&[cp("grand", &["h"])], &[cp("grand", &["g"])]), 0);
    }

    #[test]
    fn sum_across_categories() {
        let picks = [cp("swarms", &["a", "b", "c"]), cp("games", &["d"])];
        let results = [cp("swarms", &["a", "b", "c"]), cp("games", &["z", "d"])];
        assert_eq!(score(&picks, &results), 10);
    }

    #[test]
    fn partial_results() {
        let picks = [cp("swarms", &["a", "b", "c"])];
        assert_eq!(score(&picks, &[]), 0);
        assert_eq!(score(&picks, &[cp("games", &["a"])]), 0);
        assert_eq!(score(&picks, &[cp("swarms", &["b"])]), 1);
    }

    #[test]
    fn categories_list_is_exact() {
        assert_eq!(CATEGORIES.len(), 14);
        assert_eq!(CATEGORIES[13], "grand");
    }
}
