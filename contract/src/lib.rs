//! The Hackathon Market: humans and AI agents predict NEAR Hackathon track winners.
//! Picks lock at `lock_at_ns`; the owner enters official results afterwards and
//! the leaderboard is computed on read. Rules: see RULES.md.

mod scoring;
mod validate;

pub use scoring::{CATEGORIES, CategoryPicks, score};

use near_sdk::json_types::U64;
use near_sdk::store::{IterableMap, IterableSet};
use near_sdk::{AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise, env, near, require};

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Entries,
    Agents,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Entry {
    pub picks: Vec<CategoryPicks>,
    pub updated_ns: U64,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner_id: AccountId,
    pub lock_at_ns: U64,
    pub agents: Vec<AccountId>,
    pub has_results: bool,
    pub player_count: u32,
}

#[near(serializers = [json])]
pub struct LeaderRow {
    pub account_id: AccountId,
    pub score: u32,
    pub is_agent: bool,
    pub updated_ns: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner_id: AccountId,
    lock_at_ns: u64,
    entries: IterableMap<AccountId, Entry>,
    agents: IterableSet<AccountId>,
    results: Option<Vec<CategoryPicks>>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, lock_at_ns: U64) -> Self {
        Self {
            owner_id,
            lock_at_ns: lock_at_ns.0,
            entries: IterableMap::new(StorageKey::Entries),
            agents: IterableSet::new(StorageKey::Agents),
            results: None,
        }
    }

    /// Replaces the caller's picks. The caller pays for any storage growth;
    /// the unused part of the deposit is refunded.
    #[payable]
    pub fn submit_picks(&mut self, picks: Vec<CategoryPicks>) {
        require!(env::block_timestamp() < self.lock_at_ns, "Picks are locked");
        validate::validate_picks(&picks, false);

        let caller = env::predecessor_account_id();
        let before = env::storage_usage();
        self.entries.insert(caller.clone(), Entry { picks, updated_ns: U64(env::block_timestamp()) });
        self.entries.flush();
        let grown = env::storage_usage().saturating_sub(before);

        let required = env::storage_byte_cost().saturating_mul(grown as u128);
        let attached = env::attached_deposit();
        require!(attached >= required, format!("Attach at least {} yoctoNEAR", required.as_yoctonear()));
        let refund = attached.saturating_sub(required);
        if refund > NearToken::from_yoctonear(0) {
            Promise::new(caller).transfer(refund).detach();
        }
    }

    pub fn register_agent(&mut self, account_id: AccountId) {
        self.assert_owner();
        self.agents.insert(account_id);
    }

    /// Official winners. Can be corrected later; scores are computed on read.
    pub fn set_results(&mut self, results: Vec<CategoryPicks>) {
        self.assert_owner();
        require!(env::block_timestamp() >= self.lock_at_ns, "Results only after lock");
        validate::validate_picks(&results, true);
        self.results = Some(results);
    }

    pub fn get_config(&self) -> Config {
        Config {
            owner_id: self.owner_id.clone(),
            lock_at_ns: U64(self.lock_at_ns),
            agents: self.agents.iter().cloned().collect(),
            has_results: self.results.is_some(),
            player_count: self.entries.len(),
        }
    }

    pub fn get_picks(&self, account_id: AccountId) -> Option<Entry> {
        self.entries.get(&account_id).cloned()
    }

    pub fn get_results(&self) -> Option<Vec<CategoryPicks>> {
        self.results.clone()
    }

    /// Score descending, ties to whoever last edited earlier.
    pub fn get_leaderboard(&self, from_index: u32, limit: u32) -> Vec<LeaderRow> {
        let results = self.results.as_deref().unwrap_or(&[]);
        let mut rows: Vec<LeaderRow> = self
            .entries
            .iter()
            .map(|(account_id, entry)| LeaderRow {
                account_id: account_id.clone(),
                score: score(&entry.picks, results),
                is_agent: self.agents.contains(account_id),
                updated_ns: entry.updated_ns,
            })
            .collect();
        rows.sort_by(|a, b| {
            b.score.cmp(&a.score).then(a.updated_ns.0.cmp(&b.updated_ns.0)).then(a.account_id.cmp(&b.account_id))
        });
        rows.into_iter().skip(from_index as usize).take(limit as usize).collect()
    }

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Owner only");
    }
}

#[cfg(test)]
mod tests;
