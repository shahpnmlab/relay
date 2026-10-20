using Microsoft.AspNetCore.Components;

namespace Refund.Components;

/// <summary>Retains an optimistic draft while ordered, asynchronous binding callbacks complete.</summary>
public abstract class BufferedInputBase<TValue> : ComponentBase, IDisposable
{
    private readonly SemaphoreSlim _commitGate = new(1, 1);
    private TValue _editingValue;
    private bool _hasEditingValue;
    private int _pendingEdits;
    private long _editSequence;
    private bool _disposed;

    [Parameter] public TValue Value { get; set; }
    [Parameter] public EventCallback<TValue> ValueChanged { get; set; }

    protected TValue EditingValue => _hasEditingValue ? _editingValue : Value;
    protected bool IsDisposed => _disposed;

    protected override void OnParametersSet()
    {
        if (_pendingEdits == 0)
        {
            _editingValue = Value;
            _hasEditingValue = true;
        }
        base.OnParametersSet();
    }

    protected async Task SetValueAsync(TValue value)
    {
        if (_disposed || (_hasEditingValue && EqualityComparer<TValue>.Default.Equals(_editingValue, value)))
            return;

        _editingValue = value;
        _hasEditingValue = true;
        _pendingEdits++;
        var sequence = ++_editSequence;
        var callback = ValueChanged;
        await _commitGate.WaitAsync();
        try
        {
            // Each queued value is a complete draft. Superseded assignments need not hit storage.
            if (!_disposed && sequence == _editSequence)
                await callback.InvokeAsync(value);
        }
        finally
        {
            _pendingEdits--;
            if (_pendingEdits == 0)
                _editingValue = Value;
            _commitGate.Release();
        }
    }

    public virtual void Dispose()
    {
        _disposed = true;
        // In-flight callbacks still own the gate; queued edits skip their callback on disposal.
    }
}
