using System;
using System.Diagnostics;
using System.Net.Sockets;
using System.Threading;

sealed class Program
{
    const int Port = 5173;
    const string Url = "http://localhost:5173/";
    const string Project = @"c:\Users\proan\Downloads\project\gym and nutrotious tracker";
    const string Npm = @"C:\Program Files\nodejs\npm.cmd";

    static void Main()
    {
        if (!PortOpen()) StartServer();
        for (var i = 0; i < 80 && !PortOpen(); i++) Thread.Sleep(250);
        Process.Start(new ProcessStartInfo(Url) { UseShellExecute = true });
    }

    static bool PortOpen()
    {
        try
        {
            using (var client = new TcpClient())
            {
                var wait = client.BeginConnect("127.0.0.1", Port, null, null);
                if (!wait.AsyncWaitHandle.WaitOne(400)) return false;
                client.EndConnect(wait);
                return client.Connected;
            }
        }
        catch
        {
            return false;
        }
    }

    static void StartServer()
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = Npm,
            Arguments = "run dev",
            WorkingDirectory = Project,
            UseShellExecute = false,
            CreateNoWindow = true,
        });
    }
}
