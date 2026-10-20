using System.Globalization;
using Microsoft.AspNetCore.Components;
using Microsoft.FluentUI.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Refund.Components;

/// <summary>Adapts string-valued job metadata bounds to the v5 typed numeric input.</summary>
public partial class RobustFluentNumberField<TValue> : BufferedInputBase<TValue>, IAsyncDisposable where TValue : new()
{
    [Inject] private IJSRuntime JS { get; set; }
    private FluentNumberInput<TValue> _input;
    private IJSObjectReference? _module;
    private (string? Min, string? Max, string? Step, bool Disabled)? _stepOptions;
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

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        var options = (Min, Max, Step, Disabled);
        if (_stepOptions == options)
            return;

        _stepOptions = options;
        _module ??= await JS.InvokeAsync<IJSObjectReference>("import", "./_content/Refund/Components/RobustFluentNumberField.razor.js");
        if (IsDisposed)
        {
            await _module.DisposeAsync();
            return;
        }
        var culture = CultureInfo.CurrentCulture.NumberFormat;
        await _module.InvokeVoidAsync("configure", _input.Element,
            Convert.ToString(ParseBound(Min, "Min"), CultureInfo.InvariantCulture),
            Convert.ToString(ParseBound(Max, "Max"), CultureInfo.InvariantCulture),
            Convert.ToString(ParseBound(Step, "Step"), CultureInfo.InvariantCulture),
            culture.NumberDecimalSeparator, culture.NumberGroupSeparator);
    }

    public async ValueTask DisposeAsync()
    {
        Dispose();
        if (_module is null)
            return;
        try
        {
            await _module.InvokeVoidAsync("cleanup", _input.Element);
            await _module.DisposeAsync();
        }
        catch (Exception e) when (e is JSDisconnectedException or OperationCanceledException) { }
    }

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
