namespace Refund.Components.FileBrowser;

public sealed class UploadProgressState(string fileName)
{
    public string Id { get; } = Guid.NewGuid().ToString("N");
    public string FileName { get; } = fileName;
    public int Progress { get; private set; }
    public event Action? Changed;

    public void Update(int progress)
    {
        Progress = Math.Clamp(progress, 0, 100);
        Changed?.Invoke();
    }
}
