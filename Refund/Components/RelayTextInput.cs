using Microsoft.AspNetCore.Components;
using Microsoft.FluentUI.AspNetCore.Components;

namespace Refund.Components;

/// <summary>Normalizes empty text before Fluent v5 captures its focused-value snapshot.</summary>
public class RelayTextInput(LibraryConfiguration configuration) : FluentTextInput(configuration)
{
    public override Task SetParametersAsync(ParameterView parameters) =>
        base.SetParametersAsync(TextInputParameters.Normalize(parameters));
}

internal static class TextInputParameters
{
    internal static ParameterView Normalize(ParameterView parameters)
    {
        // Fluent uses null to mean "no frozen value yet". A null initial Value can therefore
        // change the rendered value during typing, defeating the focused-input protection.
        if (!parameters.TryGetValue<string>(nameof(RelayTextInput.Value), out var value) || value is not null)
            return parameters;

        var normalized = parameters.ToDictionary().ToDictionary(p => p.Key, p => p.Value);
        normalized[nameof(RelayTextInput.Value)] = string.Empty;
        return ParameterView.FromDictionary(normalized);
    }
}
