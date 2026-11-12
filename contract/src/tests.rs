use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const LOCK: u64 = 1_794_787_200_000_000_000;
const BEFORE: u64 = LOCK - 1_000;
const AFTER: u64 = LOCK + 1_000;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn ctx(caller: &str, deposit: NearToken, now_ns: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(acc("market.hackket.testnet"))
        .predecessor_account_id(acc(caller))
        .signer_account_id(acc(caller))
        .attached_deposit(deposit)
        .block_timestamp(now_ns)
        .build());
}

fn deposit() -> NearToken {
    NearToken::from_millinear(50)
}

fn cp(category: &str, ids: &[&str]) -> CategoryPicks {
    CategoryPicks { category: category.to_string(), ids: ids.iter().map(|s| s.to_string()).collect() }
}

fn contract() -> Contract {
    ctx("hackket.testnet", NearToken::from_yoctonear(0), BEFORE);
    Contract::new(acc("hackket.testnet"), U64(LOCK))
}

#[test]
fn submit_before_lock_stores_entry() {
    let mut c = contract();
    ctx("alice.testnet", deposit(), BEFORE);
    c.submit_picks(vec![cp("swarms", &["a", "b", "c"])]);
    let entry = c.get_picks(acc("alice.testnet")).unwrap();
    assert_eq!(entry.picks, vec![cp("swarms", &["a", "b", "c"])]);
    assert_eq!(entry.updated_ns, U64(BEFORE));
    assert_eq!(c.get_config().player_count, 1);
}

#[test]
#[should_panic(expected = "Picks are locked")]
fn submit_after_lock_fails() {
    let mut c = contract();
    ctx("alice.testnet", deposit(), AFTER);
    c.submit_picks(vec![cp("swarms", &["a"])]);
}

#[test]
#[should_panic(expected = "Unknown category")]
fn rejects_unknown_category() {
    let mut c = contract();
    ctx("alice.testnet", deposit(), BEFORE);
    c.submit_picks(vec![cp("cooking", &["a"])]);
}

#[test]
#[should_panic(expected = "Duplicate category")]
fn rejects_duplicate_category() {
    let mut c = contract();
    ctx("alice.testnet", deposit(), BEFORE);
    c.submit_picks(vec![cp("games", &["a"]), cp("games", &["b"])]);
}

#[test]
#[should_panic(expected = "1 to 3 distinct ids")]
fn rejects_more_than_3_ids() {
    let mut c = contract();
    ctx("alice.testnet", deposit(), BEFORE);
    c.submit_picks(vec![cp("games", &["a", "b", "c", "d"])]);
}

#[test]
#[should_panic(expected = "1 to 3 distinct ids")]
fn rejects_duplicate_ids() {
    let mut c = contract();
    ctx("alice.testnet", deposit(), BEFORE);
    c.submit_picks(vec![cp("games", &["a", "a"])]);
}

#[test]
#[should_panic(expected = "grand takes exactly 1 id")]
fn grand_needs_exactly_one() {
    let mut c = contract();
    ctx("alice.testnet", deposit(), BEFORE);
    c.submit_picks(vec![cp("grand", &["a", "b"])]);
}

#[test]
#[should_panic(expected = "Bad project id")]
fn rejects_bad_id_chars() {
    let mut c = contract();
    ctx("alice.testnet", deposit(), BEFORE);
    c.submit_picks(vec![cp("games", &["A B"])]);
}

#[test]
#[should_panic(expected = "Attach at least")]
fn insufficient_deposit_fails() {
    let mut c = contract();
    ctx("alice.testnet", NearToken::from_yoctonear(0), BEFORE);
    c.submit_picks(vec![cp("games", &["a"])]);
}

#[test]
fn resubmit_replaces_and_shrinks() {
    let mut c = contract();
    ctx("alice.testnet", deposit(), BEFORE);
    c.submit_picks(vec![cp("games", &["a"]), cp("nfts", &["b"]), cp("defi", &["c"])]);
    ctx("alice.testnet", NearToken::from_yoctonear(0), BEFORE + 5);
    c.submit_picks(vec![cp("games", &["z"])]);
    assert_eq!(c.get_picks(acc("alice.testnet")).unwrap().picks, vec![cp("games", &["z"])]);
    assert_eq!(c.get_config().player_count, 1);
}

#[test]
#[should_panic(expected = "Owner only")]
fn set_results_owner_only() {
    let mut c = contract();
    ctx("alice.testnet", NearToken::from_yoctonear(0), AFTER);
    c.set_results(vec![cp("games", &["a"])]);
}

#[test]
#[should_panic(expected = "Results only after lock")]
fn set_results_before_lock_fails() {
    let mut c = contract();
    ctx("hackket.testnet", NearToken::from_yoctonear(0), BEFORE);
    c.set_results(vec![cp("games", &["a"])]);
}

#[test]
#[should_panic(expected = "Owner only")]
fn register_agent_owner_only() {
    let mut c = contract();
    ctx("alice.testnet", NearToken::from_yoctonear(0), BEFORE);
    c.register_agent(acc("alice.testnet"));
}

#[test]
fn results_allow_partial_categories() {
    let mut c = contract();
    ctx("hackket.testnet", NearToken::from_yoctonear(0), AFTER);
    c.set_results(vec![cp("games", &[]), cp("grand", &["g"])]);
    assert!(c.get_config().has_results);
    assert_eq!(c.get_results().unwrap().len(), 2);
}

#[test]
fn leaderboard_sorted_with_agents_flagged() {
    let mut c = contract();
    ctx("hackket.testnet", NearToken::from_yoctonear(0), BEFORE);
    c.register_agent(acc("screener.hackket.testnet"));

    ctx("bob.testnet", deposit(), BEFORE + 1);
    c.submit_picks(vec![cp("games", &["a"])]); // 3
    ctx("alice.testnet", deposit(), BEFORE + 2);
    c.submit_picks(vec![cp("games", &["a"])]); // 3, later
    ctx("screener.hackket.testnet", deposit(), BEFORE + 3);
    c.submit_picks(vec![cp("games", &["a"]), cp("grand", &["g"])]); // 8

    ctx("hackket.testnet", NearToken::from_yoctonear(0), AFTER);
    c.set_results(vec![cp("games", &["a"]), cp("grand", &["g"])]);

    let board = c.get_leaderboard(0, 10);
    let names: Vec<String> = board.iter().map(|r| r.account_id.to_string()).collect();
    assert_eq!(names, vec!["screener.hackket.testnet", "bob.testnet", "alice.testnet"]);
    assert_eq!(board[0].score, 8);
    assert!(board[0].is_agent);
    assert!(!board[1].is_agent);

    let page = c.get_leaderboard(1, 1);
    assert_eq!(page.len(), 1);
    assert_eq!(page[0].account_id, acc("bob.testnet"));
}

#[test]
fn leaderboard_before_results_is_all_zero() {
    let mut c = contract();
    ctx("alice.testnet", deposit(), BEFORE);
    c.submit_picks(vec![cp("games", &["a"])]);
    let board = c.get_leaderboard(0, 10);
    assert_eq!(board.len(), 1);
    assert_eq!(board[0].score, 0);
}
