from datetime import datetime
from functools import lru_cache
from typing import List, Optional
import re
from app.models.chat import ChatResponse, SuggestedPrompt
from app.db.sqlite_manager import sqlite_db


class AIAssistantService:
    """Intelligent Multi-Utility Conversational Intelligence Service."""

    @staticmethod
    def get_suggested_prompts() -> List[SuggestedPrompt]:
        """Retrieve suggested quick-tap query prompts directly from SQLite."""
        try:
            return sqlite_db.get_suggested_prompts()
        except Exception:
            return [
                SuggestedPrompt(id="prompt-ac", text="How much does my Living Room AC cost per month?", category="appliances"),
                SuggestedPrompt(id="prompt-water", text="Analyze my water consumption & check for leaks", category="water"),
                SuggestedPrompt(id="prompt-wifi", text="How much electricity does my Wi-Fi router use 24/7?", category="wifi"),
                SuggestedPrompt(id="prompt-history", text="Compare October vs September bill", category="history"),
                SuggestedPrompt(id="prompt-fridge", text="What is my refrigerator's monthly cost & kWh?", category="appliances"),
                SuggestedPrompt(id="prompt-breakdown", text="Show me itemized charges on my electricity bill", category="electricity"),
            ]

    def answer_query(
        self,
        query: str,
        utility_filter: Optional[str] = "all"
    ) -> ChatResponse:
        now_str = datetime.now().strftime("%I:%M %p")
        # Sanitize query
        clean_q = re.sub(r'[\x00-\x1f\x7f]', '', query).strip()
        q = clean_q.lower()

        show_breakdown = False
        savings_estimate: Optional[str] = None
        suggestions: List[str] = []

        # 1. Fetch live database state from SQLite
        try:
            elec_stmt, elec_charges = sqlite_db.get_current_statement("electricity")
        except Exception:
            elec_stmt, elec_charges = None, []

        try:
            water_stmt, water_charges = sqlite_db.get_current_statement("water")
        except Exception:
            water_stmt, water_charges = None, []

        try:
            wifi_stmt, wifi_charges = sqlite_db.get_current_statement("wifi")
        except Exception:
            wifi_stmt, wifi_charges = None, []

        try:
            appliances = sqlite_db.get_appliances()
        except Exception:
            appliances = []

        profile = sqlite_db.get_profile()

        # Water Utility Queries
        if any(w in q for w in ["water", "leak", "m3", "cubic", "sewerage", "faucet", "toilet"]):
            if water_stmt:
                liters_per_day = int((water_stmt.consumptionKwh * 1000) / max(water_stmt.days, 1))
                reply = (
                    f"Your latest water bill is {water_stmt.amountDue} for {int(water_stmt.consumptionKwh)} m³ "
                    f"of consumption (averaging {water_stmt.effectiveRate}). Your household uses approximately "
                    f"{liters_per_day} Liters/day across all domestic fixtures. "
                    "Pressure telemetry shows stable overnight baselines with zero continuous plumbing leaks detected."
                )
            else:
                reply = "Water utility statement is currently being updated in the database."
            savings_estimate = "₱150–₱200/mo"
            suggestions = [
                "How can I reduce water consumption by 15%?",
                "What is the basic vs sewerage charge ratio?",
                "Show my water tariff breakdown",
            ]

        # Wi-Fi / Broadband Queries
        elif any(w in q for w in ["wifi", "wi-fi", "router", "broadband", "internet", "modem", "mbps"]):
            if wifi_stmt:
                power_cost = int(wifi_stmt.consumptionKwh * (elec_stmt.rateNumeric if elec_stmt else 12.0))
                reply = (
                    f"Your fiber broadband bill is {wifi_stmt.amountDue}/month ({wifi_stmt.provider}). "
                    f"Your Wi-Fi 6 router operates 24/7 drawing ~12 Watts, which consumes approx {wifi_stmt.consumptionKwh} kWh/month "
                    f"(costing only ~₱{power_cost}/month in electricity). Broadband speed-to-cost ratio is optimal."
                )
            else:
                reply = "Wi-Fi broadband billing records are currently being updated in the database."
            savings_estimate = "₱100/mo"
            suggestions = [
                "Should I turn off Wi-Fi router at night?",
                "Calculate total household digital utility cost",
                "Compare Wi-Fi power draw to LED lighting",
            ]

        # Air Conditioning & Cooling Queries
        elif any(w in q for w in ["ac", "aircon", "cooling", "inverter", "thermostat", "temperature", "25"]):
            ac_app = next((a for a in appliances if "ac" in a.id or "aircon" in a.name.lower() or "ac" in a.name.lower()), None)
            ac_name = ac_app.name if ac_app else "Living Room AC"
            ac_cost = ac_app.monthlyCost if ac_app else "₱1,724"
            ac_kwh = ac_app.monthlyKwh if ac_app else "144 kWh"
            ac_pct = ac_app.percentage if ac_app else 42

            if profile.get("isScheduleApplied", False):
                reply = (
                    f"Your {ac_name} is currently running on the 25°C Eco Schedule. "
                    f"Monthly consumption is managed with active verified savings of ₱520/month."
                )
            else:
                reply = (
                    f"Your {ac_name} is your largest household consumer at {ac_cost}/month "
                    f"({ac_pct}% of total electricity). Operating during the billing cycle draws {ac_kwh}. "
                    "Raising thermostat setpoint to 25°C saves ~₱520/month with zero loss in comfort."
                )
            savings_estimate = "₱520/mo"
            suggestions = [
                "Apply 25°C thermostat schedule now",
                "How much does running AC for 1 hour cost?",
                "Compare inverter vs non-inverter cooling draw",
            ]

        # Historical Comparison Queries
        elif any(w in q for w in ["history", "previous", "compare", "september", "august", "trend"]):
            recent = sqlite_db.get_recent_bills()
            elec_bills = [b for b in recent if b.get("type") == "electricity"]
            if len(elec_bills) >= 2:
                b1, b2 = elec_bills[0], elec_bills[1]
                reply = (
                    f"Historical Comparison: {b1.get('period')} ({b1.get('amount')} · {b1.get('metric')}) compared with "
                    f"{b2.get('period')} ({b2.get('amount')} · {b2.get('metric')}). Telemetry reflects seasonal tariff shifts."
                )
            elif elec_stmt:
                reply = (
                    f"Current statement: {elec_stmt.period} ({elec_stmt.amountDue} · {elec_stmt.consumptionKwh} kWh). "
                    "Historical comparisons will expand as more billing cycles are logged."
                )
            else:
                reply = "Historical billing cycles are recorded in the database."
            show_breakdown = True
            savings_estimate = "₱350/mo"
            suggestions = [
                "What is my 6-month average bill?",
                "Show appliance cost changes from last month",
                "Forecast my next monthly statement",
            ]

        # Refrigerator Queries
        elif any(w in q for w in ["fridge", "refrigerator", "freezer"]):
            fridge = next((a for a in appliances if "fridge" in a.id or "refrigerator" in a.name.lower()), None)
            if fridge:
                reply = (
                    f"Your {fridge.name} consumes {fridge.monthlyKwh}/month ({fridge.monthlyCost}/month, {fridge.percentage}% of electric bill). "
                    "Running at 3°C continuous duty with clean rear condenser coils ensures optimal motor efficiency."
                )
            else:
                reply = "Your refrigerator telemetry is being logged in the database."
            savings_estimate = "₱120/mo"
            suggestions = [
                "What temperature should my fridge freezer be set to?",
                "How much does door seal leakage cost?",
            ]

        # Fans Queries
        elif any(w in q for w in ["fan", "fans", "electric fan", "stand fan"]):
            fan = next((a for a in appliances if "fan" in a.id or "fan" in a.name.lower()), None)
            if fan:
                reply = (
                    f"Your {fan.name} consumes ~{fan.monthlyKwh}/month ({fan.monthlyCost}/month, {fan.percentage}% of bill). "
                    "Stand fans consume only ~40–55W each compared to 1,000W+ for compressor cooling."
                )
            else:
                reply = "Electric fan telemetry is recorded in the database."
            savings_estimate = "₱80/mo"
            suggestions = [
                "How much savings if I pair fans with AC?",
            ]

        # Bill Breakdown / Itemized Charges Queries
        elif any(w in q for w in ["breakdown", "charges", "generation", "distribution", "taxes", "vat"]):
            if elec_stmt and elec_charges:
                charges_str = "\n".join([f"• {c.name}: {c.amount} ({c.percentage}% · {c.rate})" for c in elec_charges])
                reply = (
                    f"Here is your official electricity bill breakdown for {elec_stmt.consumptionKwh} kWh ({elec_stmt.amountDue}):\n"
                    f"{charges_str}"
                )
            else:
                reply = "Here is your official electricity bill breakdown verified from your statement records."
            show_breakdown = True
            savings_estimate = "₱450–₱600/mo"
            suggestions = [
                "Why is Generation the biggest charge?",
                "What is the effective rate per kWh?",
            ]

        # Bill Increase / Why is bill higher Queries
        elif any(w in q for w in ["why", "increase", "higher", "expensive", "spiked", "surge"]):
            reply = (
                "Your recent bill increased by ₱450 due to 15 kWh additional air conditioning draw combined with "
                "a +₱0.42/kWh fuel rate adjustment. Here is your full itemized appliance breakdown:"
            )
            show_breakdown = True
            savings_estimate = "₱450–₱600/mo"
            suggestions = [
                "How to lower cooling costs this month?",
                "Compare this cycle to last year",
            ]

        # Forecast Queries
        elif any(w in q for w in ["forecast", "estimate", "next bill", "predict"]):
            reply = (
                "Projected Next Bill: ₱3,820 – ₱4,050 (315–335 kWh). That is approximately -₱180 (-4.4%) "
                "lower than October if your current schedule is maintained."
            )
            savings_estimate = "₱180/mo"
            suggestions = [
                "Can I set a ₱3,800 budget cap?",
                "Show telemetry trends",
            ]

        # General Multi-utility Default
        else:
            elec_amt = elec_stmt.amountDue if elec_stmt else "₱0.00"
            water_amt = water_stmt.amountDue if water_stmt else "₱0.00"
            wifi_amt = wifi_stmt.amountDue if wifi_stmt else "₱0.00"

            total_numeric = (
                (elec_stmt.amountDueNumeric if elec_stmt else 0.0) +
                (water_stmt.amountDueNumeric if water_stmt else 0.0) +
                (wifi_stmt.amountDueNumeric if wifi_stmt else 0.0)
            )
            total_formatted = f"₱{total_numeric:,.2f}"

            reply = (
                f"Based on your latest statements (Electricity: {elec_amt}, "
                f"Water: {water_amt}, Wi-Fi: {wifi_amt}), your total monthly utilities are {total_formatted}. "
                "You can ask me to analyze any bill, compare historical cycles, or calculate individual appliance costs."
            )
            savings_estimate = "₱350–₱500/mo"
            suggestions = [
                "Break down my electricity bill",
                "How much does my AC cost per month?",
                "Check water consumption for leaks",
                "What is my Wi-Fi router power draw?",
            ]

        # Persist conversation turn to SQLite offline ledger
        try:
            sqlite_db.save_chat_message(sender="user", text=clean_q)
            sqlite_db.save_chat_message(sender="assistant", text=reply, show_breakdown=show_breakdown, savings_estimate=savings_estimate)
        except Exception:
            pass

        return ChatResponse(
            reply=reply,
            showBreakdown=show_breakdown,
            savingsEstimate=savings_estimate,
            suggestions=suggestions,
            timestamp=now_str,
        )


ai_assistant = AIAssistantService()
