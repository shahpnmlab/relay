namespace Refund.Components;

/// <summary>An option presented in a Relay selection control.</summary>
public sealed class SelectOption<TValue>
{
    public TValue Value { get; set; }
    public string Text { get; set; } = "";
    public bool Selected { get; set; }
}
