import { SSMClient, GetServiceSettingCommand, UpdateServiceSettingCommand, ListDocumentsCommand, CreateDocumentCommand, GetDocumentCommand, UpdateDocumentCommand } from "@aws-sdk/client-ssm";
import { readFileSync } from "fs";
import { resolve } from "path";

const SESSION_MANAGER_RUN_SHELL_CONTENT_PATH = resolve(__dirname, "../sessionManagerRunShell.json");
const SETTING_ID = `/ssm/managed-instance/activation-tier`;

const ssmClient = new SSMClient({});

export async function deploySSMRunShell(accountId: string) {
    
    const serviceSetting = await ssmClient.send(new GetServiceSettingCommand({ SettingId: SETTING_ID }));
    const settingValue = serviceSetting.ServiceSetting?.SettingValue;

    if (settingValue === "standard") {
        await ssmClient.send(new UpdateServiceSettingCommand({ 
            SettingId: SETTING_ID, 
            SettingValue: "advanced" 
        }));
    }

    const documentList = await ssmClient.send(new ListDocumentsCommand({
        DocumentFilterList: [{ key: "Name", value: "SSM-SessionManagerRunShell" }]
    }));

    const documentCount = documentList.DocumentIdentifiers?.length;

    if (documentCount === 0) {
        await ssmClient.send(new CreateDocumentCommand({
            Name: "SSM-SessionManagerRunShell",
            Content: readFileSync(SESSION_MANAGER_RUN_SHELL_CONTENT_PATH, "utf8"),
            DocumentType: "Session"
        }));
    } else {
        const currentDocument = await ssmClient.send(new GetDocumentCommand({
            Name: "SSM-SessionManagerRunShell",
            DocumentVersion: "$LATEST"
        }));

        const newDocument = readFileSync(SESSION_MANAGER_RUN_SHELL_CONTENT_PATH, "utf8");

        if (JSON.stringify(currentDocument.Content) !== JSON.stringify(newDocument)) {
            await ssmClient.send(new UpdateDocumentCommand({
                Name: "SSM-SessionManagerRunShell",
                Content: newDocument,
                DocumentVersion: "$LATEST"
            }));
        }
    }
}