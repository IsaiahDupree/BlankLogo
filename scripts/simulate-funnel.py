#!/usr/bin/env python3
"""
BlankLogo Funnel Simulator - Monte Carlo User Simulation

Simulates user journeys from ad impression → churn/retention.
Use to forecast purchases, CAC, churn rate, and LTV.

Usage:
  python scripts/simulate-funnel.py
  python scripts/simulate-funnel.py --impressions 50000 --simulations 100
"""

import random
import argparse
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import json
from datetime import datetime


@dataclass
class FunnelRates:
    """Transition probabilities between funnel stages."""
    
    # Ad → Landing
    ctr: float = 0.02  # Click-through rate from ad
    
    # Landing → Activation
    p_cta: float = 0.30  # CTA click rate on landing
    p_signup: float = 0.50  # Signup submit after CTA
    p_login: float = 0.80  # Login success after signup (email open + click)
    
    # Activation → Value
    p_upload: float = 0.90  # Upload attempt after login
    p_job_success: float = 0.85  # Job completes successfully
    p_download: float = 0.95  # Download clicked after success
    
    # Value → Revenue
    p_purchase: float = 0.10  # Purchase after aha moment
    
    # Retention
    p_repeat_30d: float = 0.40  # Returns within 30 days
    p_repeat_60d: float = 0.25  # Returns within 60 days (if not 30d)
    
    # Churn factors
    base_churn: float = 0.25  # Base monthly churn
    extra_churn_if_fail: float = 0.20  # Added if job fails
    extra_churn_if_slow: float = 0.10  # Added if processing > 2min
    slow_rate: float = 0.15  # % of jobs that are "slow"
    
    @classmethod
    def from_dict(cls, d: dict) -> 'FunnelRates':
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class SimulationResult:
    """Results from a single cohort simulation."""
    
    impressions: int = 0
    clicks: int = 0
    cta_clicks: int = 0
    signups: int = 0
    logins: int = 0
    uploads: int = 0
    job_successes: int = 0
    aha_moments: int = 0  # First download
    purchasers: int = 0
    retained_30d: int = 0
    retained_60d: int = 0
    churned: int = 0
    
    # Computed metrics
    @property
    def ctr(self) -> float:
        return self.clicks / self.impressions if self.impressions else 0
    
    @property
    def activation_rate(self) -> float:
        return self.logins / self.clicks if self.clicks else 0
    
    @property
    def aha_rate(self) -> float:
        return self.aha_moments / self.logins if self.logins else 0
    
    @property
    def purchase_rate_per_click(self) -> float:
        return self.purchasers / self.clicks if self.clicks else 0
    
    @property
    def purchase_rate_per_aha(self) -> float:
        return self.purchasers / self.aha_moments if self.aha_moments else 0
    
    @property
    def churn_rate_30d(self) -> float:
        active = self.aha_moments
        return self.churned / active if active else 0
    
    @property
    def retention_rate_30d(self) -> float:
        active = self.aha_moments
        return self.retained_30d / active if active else 0
    
    def to_dict(self) -> dict:
        return {
            "impressions": self.impressions,
            "clicks": self.clicks,
            "cta_clicks": self.cta_clicks,
            "signups": self.signups,
            "logins": self.logins,
            "uploads": self.uploads,
            "job_successes": self.job_successes,
            "aha_moments": self.aha_moments,
            "purchasers": self.purchasers,
            "retained_30d": self.retained_30d,
            "retained_60d": self.retained_60d,
            "churned": self.churned,
            # Computed
            "ctr": round(self.ctr, 4),
            "activation_rate": round(self.activation_rate, 4),
            "aha_rate": round(self.aha_rate, 4),
            "purchase_rate_per_click": round(self.purchase_rate_per_click, 4),
            "purchase_rate_per_aha": round(self.purchase_rate_per_aha, 4),
            "churn_rate_30d": round(self.churn_rate_30d, 4),
            "retention_rate_30d": round(self.retention_rate_30d, 4),
        }


def simulate_cohort(impressions: int, rates: FunnelRates) -> SimulationResult:
    """
    Simulate a cohort of users through the funnel.
    
    Funnel stages:
    S0: Impression
    S1: Click (landed)
    S2: CTA Click
    S3: Signup Submit
    S4: Login Success (activated)
    S5: Upload Attempt
    S6: Job Success
    S7: Download (aha moment)
    S8: Purchase
    S9: Retained 30d
    S10: Retained 60d
    S11: Churned
    """
    result = SimulationResult(impressions=impressions)
    
    # Impressions → Clicks
    result.clicks = sum(1 for _ in range(impressions) if random.random() < rates.ctr)
    
    for _ in range(result.clicks):
        # Landing → CTA
        if random.random() >= rates.p_cta:
            continue
        result.cta_clicks += 1
        
        # CTA → Signup
        if random.random() >= rates.p_signup:
            continue
        result.signups += 1
        
        # Signup → Login (email flow)
        if random.random() >= rates.p_login:
            continue
        result.logins += 1
        
        # Login → Upload
        if random.random() >= rates.p_upload:
            result.churned += 1
            continue
        result.uploads += 1
        
        # Upload → Job Success
        job_slow = random.random() < rates.slow_rate
        job_success = random.random() < rates.p_job_success
        
        if not job_success:
            # Failed job - high churn risk
            churn_prob = min(rates.base_churn + rates.extra_churn_if_fail, 0.95)
            result.churned += 1
            continue
        
        result.job_successes += 1
        
        # Job Success → Download (aha moment)
        if random.random() >= rates.p_download:
            result.churned += 1
            continue
        
        result.aha_moments += 1
        
        # Aha → Purchase
        if random.random() < rates.p_purchase:
            result.purchasers += 1
        
        # Churn model
        churn_prob = rates.base_churn
        if job_slow:
            churn_prob += rates.extra_churn_if_slow
        churn_prob = min(max(churn_prob, 0), 0.95)
        
        if random.random() < churn_prob:
            result.churned += 1
        elif random.random() < rates.p_repeat_30d:
            result.retained_30d += 1
        elif random.random() < rates.p_repeat_60d:
            result.retained_60d += 1
        else:
            result.churned += 1
    
    return result


def run_monte_carlo(
    impressions: int,
    rates: FunnelRates,
    simulations: int = 100
) -> Dict:
    """
    Run multiple simulations and aggregate results.
    """
    results: List[SimulationResult] = []
    
    for _ in range(simulations):
        result = simulate_cohort(impressions, rates)
        results.append(result)
    
    # Aggregate
    def avg(key: str) -> float:
        values = [getattr(r, key) for r in results]
        return sum(values) / len(values)
    
    def std(key: str) -> float:
        values = [getattr(r, key) for r in results]
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        return variance ** 0.5
    
    return {
        "config": {
            "impressions": impressions,
            "simulations": simulations,
            "rates": rates.__dict__,
        },
        "averages": {
            "clicks": round(avg("clicks"), 1),
            "cta_clicks": round(avg("cta_clicks"), 1),
            "signups": round(avg("signups"), 1),
            "logins": round(avg("logins"), 1),
            "uploads": round(avg("uploads"), 1),
            "job_successes": round(avg("job_successes"), 1),
            "aha_moments": round(avg("aha_moments"), 1),
            "purchasers": round(avg("purchasers"), 1),
            "retained_30d": round(avg("retained_30d"), 1),
            "churned": round(avg("churned"), 1),
        },
        "rates": {
            "ctr": round(avg("ctr"), 4),
            "activation_rate": round(avg("activation_rate"), 4),
            "aha_rate": round(avg("aha_rate"), 4),
            "purchase_rate_per_click": round(avg("purchase_rate_per_click"), 4),
            "purchase_rate_per_aha": round(avg("purchase_rate_per_aha"), 4),
            "churn_rate_30d": round(avg("churn_rate_30d"), 4),
            "retention_rate_30d": round(avg("retention_rate_30d"), 4),
        },
        "std_dev": {
            "purchasers": round(std("purchasers"), 2),
            "aha_moments": round(std("aha_moments"), 2),
            "retained_30d": round(std("retained_30d"), 2),
        },
    }


def calculate_unit_economics(
    simulation: Dict,
    cpc: float = 1.50,
    credit_pack_price: float = 9.99,
    subscription_price: float = 19.99,
    subscription_share: float = 0.20,
) -> Dict:
    """
    Calculate CAC, LTV, and ROAS from simulation results.
    """
    avg = simulation["averages"]
    
    # Costs
    total_spend = avg["clicks"] * cpc
    cac = total_spend / avg["purchasers"] if avg["purchasers"] else float('inf')
    
    # Revenue (simple model)
    one_time_revenue = avg["purchasers"] * (1 - subscription_share) * credit_pack_price
    sub_revenue = avg["purchasers"] * subscription_share * subscription_price * 6  # 6 month avg
    total_revenue = one_time_revenue + sub_revenue
    
    # ROAS
    roas = total_revenue / total_spend if total_spend else 0
    
    # LTV (simplified)
    ltv = total_revenue / avg["purchasers"] if avg["purchasers"] else 0
    
    return {
        "total_ad_spend": round(total_spend, 2),
        "total_revenue": round(total_revenue, 2),
        "cac": round(cac, 2),
        "ltv": round(ltv, 2),
        "ltv_cac_ratio": round(ltv / cac, 2) if cac and cac != float('inf') else 0,
        "roas": round(roas, 2),
        "break_even_roas": 1.0,
        "profitable": roas > 1.0,
    }


def print_report(simulation: Dict, economics: Dict):
    """Print a formatted report."""
    print("\n" + "=" * 60)
    print("BLANKLOGO FUNNEL SIMULATION REPORT")
    print("=" * 60)
    print(f"Generated: {datetime.now().isoformat()}")
    print(f"Impressions: {simulation['config']['impressions']:,}")
    print(f"Simulations: {simulation['config']['simulations']}")
    
    print("\n📊 FUNNEL METRICS (Averages)")
    print("-" * 40)
    avg = simulation["averages"]
    rates = simulation["rates"]
    print(f"  Clicks:        {avg['clicks']:>8.0f}  (CTR: {rates['ctr']*100:.2f}%)")
    print(f"  CTA Clicks:    {avg['cta_clicks']:>8.0f}")
    print(f"  Signups:       {avg['signups']:>8.0f}")
    print(f"  Logins:        {avg['logins']:>8.0f}  (Activation: {rates['activation_rate']*100:.1f}%)")
    print(f"  Uploads:       {avg['uploads']:>8.0f}")
    print(f"  Job Success:   {avg['job_successes']:>8.0f}")
    print(f"  Aha Moments:   {avg['aha_moments']:>8.0f}  (Aha Rate: {rates['aha_rate']*100:.1f}%)")
    print(f"  Purchasers:    {avg['purchasers']:>8.0f}  (Per Click: {rates['purchase_rate_per_click']*100:.2f}%)")
    print(f"  Retained 30d:  {avg['retained_30d']:>8.0f}  (Retention: {rates['retention_rate_30d']*100:.1f}%)")
    print(f"  Churned:       {avg['churned']:>8.0f}  (Churn: {rates['churn_rate_30d']*100:.1f}%)")
    
    print("\n💰 UNIT ECONOMICS")
    print("-" * 40)
    print(f"  Ad Spend:      ${economics['total_ad_spend']:>10,.2f}")
    print(f"  Revenue:       ${economics['total_revenue']:>10,.2f}")
    print(f"  CAC:           ${economics['cac']:>10,.2f}")
    print(f"  LTV:           ${economics['ltv']:>10,.2f}")
    print(f"  LTV:CAC:       {economics['ltv_cac_ratio']:>10.2f}x")
    print(f"  ROAS:          {economics['roas']:>10.2f}x")
    print(f"  Profitable:    {'✅ YES' if economics['profitable'] else '❌ NO'}")
    
    print("\n📈 SENSITIVITY (±1 std dev on purchasers)")
    print("-" * 40)
    std = simulation["std_dev"]
    low = max(0, avg['purchasers'] - std['purchasers'])
    high = avg['purchasers'] + std['purchasers']
    print(f"  Purchasers: {low:.0f} - {high:.0f}")
    
    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description="BlankLogo Funnel Simulator")
    parser.add_argument("--impressions", type=int, default=10000, help="Ad impressions")
    parser.add_argument("--simulations", type=int, default=100, help="Monte Carlo runs")
    parser.add_argument("--cpc", type=float, default=1.50, help="Cost per click ($)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    
    # Rate overrides
    parser.add_argument("--ctr", type=float, help="Click-through rate")
    parser.add_argument("--p-cta", type=float, help="CTA click rate")
    parser.add_argument("--p-signup", type=float, help="Signup rate")
    parser.add_argument("--p-login", type=float, help="Login rate")
    parser.add_argument("--p-job-success", type=float, help="Job success rate")
    parser.add_argument("--p-purchase", type=float, help="Purchase rate")
    
    args = parser.parse_args()
    
    # Build rates
    rates = FunnelRates()
    if args.ctr: rates.ctr = args.ctr
    if args.p_cta: rates.p_cta = args.p_cta
    if args.p_signup: rates.p_signup = args.p_signup
    if args.p_login: rates.p_login = args.p_login
    if args.p_job_success: rates.p_job_success = args.p_job_success
    if args.p_purchase: rates.p_purchase = args.p_purchase
    
    # Run simulation
    simulation = run_monte_carlo(args.impressions, rates, args.simulations)
    economics = calculate_unit_economics(simulation, cpc=args.cpc)
    
    if args.json:
        output = {
            "simulation": simulation,
            "economics": economics,
        }
        print(json.dumps(output, indent=2))
    else:
        print_report(simulation, economics)


if __name__ == "__main__":
    main()
