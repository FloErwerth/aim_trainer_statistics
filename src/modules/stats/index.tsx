"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClipboardCopyIcon, FileQuestionIcon } from "lucide-react";
import { Tooltip as ShadcnTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";

const defaultWindowsDir = "C:/Program Files (x86)/Steam/steamapps/common/FPSAimTrainer/FPSAimTrainer/stats";

//Kill #,Timestamp,Bot,Weapon,TTK,Shots,Hits,Accuracy,Damage Done,Damage Possible,Efficiency,Cheated,OverShots

//stats to display: score, accuracy, damage done, damage possible, overshots
const relevantStats = ["Score", "Avg TTK"] as const;

const scoreRegex = new RegExp("Score:,\\d+\\.\\d+");
const avgTTKRegex = new RegExp("Avg TTK:,\\d+\\.\\d+");
type Regression = { xSum: number; xxSum: number; ySum: number; xySum: number };
type Data = { name: string; Punkte: number };
type DataMap = Map<string, Data[]>;

const CustomLabel = ({ index, x, y, stroke, value }: { index: number; x: number; y: number; stroke: string; value: string | number }) => {
  const trunicatedValue = typeof value === "number" ? value.toFixed(1) : parseFloat(value).toFixed(1);
  return (
    <text x={x} y={y} dy={-10} fill={stroke} fontSize={12} fontWeight="bold" textAnchor="middle">
      {trunicatedValue}
    </text>
  );
};

const findLineByLeastSquares = (values_x: number[], values_y: number[]) => {
  let sum_x = 0;
  let sum_y = 0;
  let sum_xy = 0;
  let sum_xx = 0;
  let count = 0;

  /*
   * We'll use those constiables for faster read/write access.
   */
  let x = 0;
  let y = 0;
  const values_length = values_x.length;

  if (values_length != values_y.length) {
    return [];
  }

  /*
   * Nothing to do.
   */
  if (values_length === 0) {
    return [];
  }

  /*
   * Calculate the sum for each of the parts necessary.
   */
  for (let v = 0; v < values_length; v++) {
    x = values_x[v];
    y = values_y[v];
    sum_x += x;
    sum_y += y;
    sum_xx += x * x;
    sum_xy += x * y;
    count++;
  }

  /*
   * Calculate m and b for the formular:
   * y = x * m + b
   */
  const m = (count * sum_xy - sum_x * sum_y) / (count * sum_xx - sum_x * sum_x);
  const b = sum_y / count - (m * sum_x) / count;

  /*
   * We will make the x and y result line now
   */
  const result_values_x = [];
  const result_values_y = [];

  for (let v = 0; v < values_length; v++) {
    x = values_x[v];
    y = x * m + b;
    result_values_x.push(x);
    result_values_y.push(y);
  }

  return result_values_y.map((val) => ({ ["Lineare Progression"]: parseFloat(val.toFixed(1)) }));
};

const latestDataCutoff = 20;
export const Stats = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [opacity, setOpacity] = useState({ ["Lineare Progression"]: 1, Punkte: 1 });
  const [data, setData] = useState<Data[][]>();
  const [regressionData, setRegressionData] = useState<{ ["Lineare Progression"]: number }[][]>();
  const { toast } = useToast();

  const constructData = useCallback(async () => {
    if (inputRef.current) {
      const files = inputRef.current.files;
      if (files && files.length > 1) {
        const statsMap: DataMap = new Map();
        const latestData = files.length > latestDataCutoff ? Array.from(files).slice(-latestDataCutoff) : files;
        for (let i = 0; i < latestData.length; i++) {
          const file = latestData[i];
          const scenarioName = file.name.split("- ")[0];
          if (scenarioName) {
            const fileContent = await file.text();
            const currentScoreMatch = fileContent.match(scoreRegex);
            if (currentScoreMatch) {
              const scoreSplitt = currentScoreMatch[0].split(":,");
              if (scoreSplitt.length === 2) {
                const score = parseFloat(parseFloat(scoreSplitt[1]).toFixed(1));
                const entry = statsMap.get(scenarioName);
                if (entry) {
                  statsMap.set(scenarioName, [...entry, { name: scenarioName, Punkte: score }]);
                } else {
                  statsMap.set(scenarioName, [{ name: scenarioName, Punkte: score }]);
                }
              }
            }
          }
        }

        if (statsMap.size > 0) {
          const newData = Array.from(statsMap.values());
          setData(() => {
            const regressionData = newData.map((data) => {
              const xArr = Array(data.length)
                .fill(undefined)
                .map((_, index) => index);
              const yArr = data.map(({ Punkte }) => Punkte);
              return findLineByLeastSquares(xArr, yArr);
            });

            setRegressionData(regressionData);

            return newData;
          });
        }
      }
    }
  }, []);

  const chartWrapperStyle = useMemo(() => `top-[-40px] left-[-20px] p-2 opacity-[${data ? "1" : "0"}] transition duration-500`, [data]);

  useEffect(() => {
    console.log(opacity);
  }, [opacity]);

  const handleMouseEnter = useCallback((event: unknown) => {
    if (event !== null && typeof event === "object" && "dataKey" in event) {
      const { dataKey } = event;
      if (typeof dataKey === "string") {
        setOpacity((opacity) => ({ ...opacity, [dataKey]: 0.25 }));
      }
    }
  }, []);

  const handleMouseLeave = useCallback((event: unknown) => {
    if (event !== null && typeof event === "object" && "dataKey" in event) {
      const { dataKey } = event;
      if (typeof dataKey === "string") {
        setOpacity((opacity) => ({ ...opacity, [dataKey]: 1 }));
      }
    }
  }, []);

  const mappedCharts = useMemo(
    () =>
      data &&
      data.map((entry, index) => {
        const name = entry[0].name;
        const scores = entry.map(({ Punkte }) => Punkte);
        const minValue = Math.min(...scores);
        const maxValue = Math.max(...scores);

        return (
          <Card className="h-[600px] lg:w-2/3 w-full" key={index}>
            <CardHeader className="mb-6">{name}</CardHeader>
            <CardContent className="w-full h-[calc(100%-50px)]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={entry} className={chartWrapperStyle} width={1000} height={450}>
                  <CartesianGrid stroke="#ddd" strokeDasharray="3 3" />
                  <YAxis padding={{ top: 30, bottom: 30 }} domain={[minValue, maxValue]} />
                  <Tooltip contentStyle={{ borderRadius: 5, borderWidth: 0.5, borderColor: "hsl(240 5.9% 90%)" }} />
                  <XAxis interval="equidistantPreserveStart" padding={{ left: 30, right: 30 }} />
                  <Line strokeOpacity={opacity.Punkte} label={CustomLabel} activeDot={{ r: 8 }} type="bumpX" dataKey="Punkte" stroke="#333" />
                  <Line strokeOpacity={opacity["Lineare Progression"]} data={regressionData?.[index]} strokeDasharray={5} type="linear" dataKey="Lineare Progression" stroke="#666666cc" />
                  <Legend onMouseLeave={handleMouseLeave} onMouseEnter={handleMouseEnter} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      }),
    [chartWrapperStyle, data, handleMouseEnter, handleMouseLeave, opacity, regressionData],
  );

  return (
    <div className="w-full flex flex-col gap-12 justify-center items-center">
      <div className="max-w-xl w-full">
        <Label>Wähle Statistiken aus deinem Ordner aus, um diese anzuzeigen</Label>
        <div className="flex gap-2 items-center">
          <Input className="max-w-xl" onInput={constructData} type="file" multiple accept=".csv" ref={inputRef} />
          <TooltipProvider>
            <ShadcnTooltip>
              <TooltipTrigger>
                <FileQuestionIcon size={20} />
              </TooltipTrigger>
              <TooltipContent className="max-w-[500px] break-all">
                Der Standardpfad unter Windows ist <br />
                <div className="flex gap-2">
                  <div className="bg-accent mt-1 rounded p-1">C:/Program Files (x86)/Steam/steamapps/common/FPSAimTrainer/FPSAimTrainer/stats</div>
                  <button
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(defaultWindowsDir)
                        .then(() =>
                          toast({
                            duration: 1000,
                            title: "Kopiert.",
                          }),
                        )
                        .catch(() =>
                          toast({
                            duration: 1000,
                            title: "Kopieren nicht möglich.",
                          }),
                        );
                    }}
                  >
                    <ClipboardCopyIcon size={20} />
                  </button>
                </div>
              </TooltipContent>
            </ShadcnTooltip>
          </TooltipProvider>
        </div>
      </div>
      {mappedCharts}
    </div>
  );
};
