using System.Globalization;
using Microsoft.AspNetCore.Components;

namespace Refund.Components;

/// <summary>Adapts string-valued job metadata bounds to the v5 typed numeric input.</summary>
public partial class RobustFluentNumberField<TValue> where TValue : new()
{
    [Parameter] public TValue Value { get; set; }
    [Parameter] public EventCallback<TValue> ValueChanged { get; set; }
    [Parameter] public string? Class { get; set; }
    [Parameter] public string? Style { get; set; }
    [Parameter] public string? Placeholder { get; set; }
    [Parameter] public string? Min { get; set; }
    [Parameter] public string? Max { get; set; }
    [Parameter] public string? Step { get; set; }
    [Parameter] public bool Disabled { get; set; }
    [Parameter] public bool Immediate { get; set; }
    [Parameter] public int ImmediateDelay { get; set; } = 200;
    [Parameter] public string? AutoComplete { get; set; }

    private static TValue ParseBound(string? value, string kind)
    {
        var type = Nullable.GetUnderlyingType(typeof(TValue)) ?? typeof(TValue);
        if (!string.IsNullOrWhiteSpace(value))
            return (TValue)Convert.ChangeType(value, type, CultureInfo.InvariantCulture);

        var number = kind == "Step"
            ? Convert.ChangeType(1, type, CultureInfo.InvariantCulture)
            : type.GetField(kind == "Min" ? "MinValue" : "MaxValue")!.GetValue(null)!;
        return (TValue)number;
    }
}
