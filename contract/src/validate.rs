use crate::scoring::{CATEGORIES, CategoryPicks, GRAND};
use near_sdk::require;

const MAX_ID_LEN: usize = 64;

/// Player picks need 1-3 distinct ids per category (grand: exactly 1).
/// Results may hold 0-3 (grand: 0-1), since a track can announce fewer winners.
pub fn validate_picks(picks: &[CategoryPicks], is_results: bool) {
    let mut seen: Vec<&str> = Vec::new();
    for p in picks {
        require!(CATEGORIES.contains(&p.category.as_str()), "Unknown category");
        require!(!seen.contains(&p.category.as_str()), "Duplicate category");
        seen.push(&p.category);

        let distinct = p.ids.iter().enumerate().all(|(i, id)| !p.ids[..i].contains(id));
        if p.category == GRAND {
            let ok = if is_results { p.ids.len() <= 1 } else { p.ids.len() == 1 };
            require!(ok, "grand takes exactly 1 id");
        } else {
            let min = if is_results { 0 } else { 1 };
            require!(p.ids.len() >= min && p.ids.len() <= 3 && distinct, "Category needs 1 to 3 distinct ids");
        }
        for id in &p.ids {
            let ok = !id.is_empty()
                && id.len() <= MAX_ID_LEN
                && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
            require!(ok, "Bad project id");
        }
    }
}
